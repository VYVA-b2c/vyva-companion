import { Router } from "express";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  profiles,
  profileMemberships,
  onboardingState,
  consentLog,
  userChannelPreferences,
  userMedications,
  teamInvitations,
  users,
} from "../../shared/schema.js";
import { z } from "zod";
import { notifyElderOfProxySetup } from "../services/notifications.js";
import { getActiveProfileContext, requireActiveProfileId } from "../lib/profileAccess.js";

export const onboardingRouter = Router();

// ============================================================
// Stage ordering
// ============================================================

const STAGE_ORDER = [
  "stage_1_identity",
  "stage_2_preferences",
  "stage_3_health",
  "stage_4_care_team",
  "stage_5_consent",
  "complete",
] as const;

type OnboardingStage = typeof STAGE_ORDER[number];

function stageIndex(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage as OnboardingStage);
  return idx === -1 ? 0 : idx;
}

function friendlyStageName(stage: string): string {
  const map: Record<string, string> = {
    stage_1_identity:    "the basics step (name, phone, language)",
    stage_2_preferences: "the channel preferences step",
    stage_3_health:      "the health information step",
    stage_4_care_team:   "the care team step",
    stage_5_consent:     "the consent step",
    complete:            "onboarding",
  };
  return map[stage] ?? stage;
}

/**
 * Checks that the user's profile exists and their current_stage is at least
 * `minStage`. Returns the current stage string on success, or sends a 400
 * response and returns null on failure.
 */
async function requireStage(
  userId: string,
  minStage: OnboardingStage,
  res: Response
): Promise<string | null> {
  const rows = await db
    .select({ current_stage: profiles.current_stage })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!rows[0]) {
    res.status(400).json({
      error: "Onboarding not started",
      required_stage: "stage_1_identity",
      message: "Please complete the basics step first (POST /api/onboarding/basics).",
    });
    return null;
  }

  const current = rows[0].current_stage ?? "stage_1_identity";

  if (stageIndex(current) < stageIndex(minStage)) {
    res.status(400).json({
      error: "Stage prerequisite not met",
      current_stage: current,
      required_stage: minStage,
      message: `Please complete ${friendlyStageName(minStage)} before continuing.`,
    });
    return null;
  }

  return current;
}

// ============================================================
// Shared helpers
// ============================================================

function requireUser(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

const HAS_FIELD_FEATURE_MAP: Record<string, Record<string, boolean>> = {
  has_medications:       { feature_medication_mgmt: true },
  has_health_conditions: { feature_health_research: true, feature_vital_scan: true },
  has_allergies:         { feature_health_research: true },
  has_gp_details:        { feature_health_research: true },
  has_caregiver:         { feature_caregiver_alerts: true, feature_safety_agent: true },
  has_family_member:     { feature_caregiver_alerts: true },
  has_doctor:            { feature_health_research: true },
  has_emergency_address: { feature_safety_agent: true, feature_fall_detection: true },
  has_location:          { feature_concierge: true },
};

async function ensureOnboardingState(userId: string) {
  const rows = await db
    .select()
    .from(onboardingState)
    .where(eq(onboardingState.user_id, userId))
    .limit(1);

  if (rows[0]) return rows[0];

  await db
    .insert(onboardingState)
    .values({ user_id: userId })
    .onConflictDoNothing();

  const created = await db
    .select()
    .from(onboardingState)
    .where(eq(onboardingState.user_id, userId))
    .limit(1);

  return created[0] ?? null;
}

async function markField(userId: string, field: string): Promise<void> {
  const validFields = [
    "has_preferred_name", "has_phone_number", "has_language",
    "has_date_of_birth", "has_emergency_address", "has_checkin_preference", "has_location",
    "has_health_conditions", "has_medications", "has_allergies", "has_gp_details",
    "has_caregiver", "has_family_member", "has_doctor",
  ];

  if (!validFields.includes(field)) {
    throw new Error(`Unknown field: ${field}`);
  }

  const featureUpdates = HAS_FIELD_FEATURE_MAP[field] ?? {};

  await db
    .update(onboardingState)
    .set({
      [field]: true,
      ...featureUpdates,
      updated_at: new Date(),
    })
    .where(eq(onboardingState.user_id, userId));
}

// ============================================================
// POST /start-profile
// Creates the care-recipient profile for this login account.
// ============================================================

const startProfileSchema = z.object({
  setup_for: z.enum(["self", "someone_else"]),
  language: z.string().optional().default("es"),
});

onboardingRouter.post("/start-profile", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;

  const parsed = startProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  try {
    const [account] = await db
      .select({ email: users.email, phone_number: users.phone_number })
      .from(users)
      .where(eq(users.id, accountUserId))
      .limit(1);

    if (!account) {
      return res.status(401).json({ error: "Account not found" });
    }

    const isSelf = parsed.data.setup_for === "self";
    const profileId = isSelf ? accountUserId : crypto.randomUUID();
    const now = new Date();

    await db
      .insert(profiles)
      .values({
        id: profileId,
        email: isSelf ? account.email : null,
        phone_number: isSelf ? account.phone_number : null,
        language: parsed.data.language,
        onboarding_channel: isSelf ? "web_form" : "proxy_web",
        current_stage: "stage_1_identity",
      })
      .onConflictDoNothing();

    await db
      .insert(profileMemberships)
      .values({
        user_id: accountUserId,
        profile_id: profileId,
        role: isSelf ? "elder" : "caregiver",
        relationship: isSelf ? "self" : "setup_initiator",
        is_primary: true,
        status: "active",
        accepted_at: now,
      })
      .onConflictDoUpdate({
        target: [profileMemberships.user_id, profileMemberships.profile_id],
        set: {
          role: isSelf ? "elder" : "caregiver",
          relationship: isSelf ? "self" : "setup_initiator",
          status: "active",
          is_primary: true,
          accepted_at: now,
          updated_at: now,
        },
      });

    await db
      .update(users)
      .set({
        active_profile_id: profileId,
        onboarding_intent: parsed.data.setup_for,
      })
      .where(eq(users.id, accountUserId));

    await ensureOnboardingState(profileId);

    return res.json({
      ok: true,
      profileId,
      role: isSelf ? "elder" : "caregiver",
      nextRoute: isSelf ? "/onboarding/basics" : "/onboarding/proxy-setup",
    });
  } catch (e) {
    console.error("[onboarding] POST /start-profile error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// GET /state
// ============================================================

onboardingRouter.get("/state", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;

  try {
    const context = await getActiveProfileContext(accountUserId);
    if (!context.profileId) {
      return res.json({
        profile: null,
        onboardingState: null,
        account: { id: accountUserId, activeProfileId: null, role: null },
      });
    }

    const [profileRows, stateRow] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, context.profileId)).limit(1),
      ensureOnboardingState(context.profileId),
    ]);

    return res.json({
      profile: profileRows[0] ?? null,
      onboardingState: stateRow,
      account: { id: accountUserId, activeProfileId: context.profileId, role: context.role },
    });
  } catch (e) {
    console.error("[onboarding] GET /state error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// GET /careteam  — returns all team_invitations for the user
// ============================================================

onboardingRouter.get("/careteam", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  try {
    const members = await db
      .select({
        id:             teamInvitations.id,
        invitee_name:   teamInvitations.invitee_name,
        invitee_phone:  teamInvitations.invitee_phone,
        invitee_email:  teamInvitations.invitee_email,
        role:           teamInvitations.role,
        relationship:   teamInvitations.relationship,
        status:         teamInvitations.status,
        created_at:     teamInvitations.created_at,
        expires_at:     teamInvitations.expires_at,
        accepted_at:    teamInvitations.accepted_at,
      })
      .from(teamInvitations)
      .where(eq(teamInvitations.senior_id, userId))
      .orderBy(teamInvitations.created_at);

    return res.json({ members });
  } catch (e) {
    console.error("[onboarding] GET /careteam error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// PATCH /careteam/:id  — revoke a pending or accepted invitation
// Body: { reason?: string }
// ============================================================

onboardingRouter.patch("/careteam/:id", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  const { id } = req.params;
  const reason = typeof req.body?.reason === "string" ? req.body.reason : "revoked_by_senior";

  try {
    const rows = await db
      .select({ id: teamInvitations.id, status: teamInvitations.status, senior_id: teamInvitations.senior_id })
      .from(teamInvitations)
      .where(eq(teamInvitations.id, id))
      .limit(1);

    if (!rows.length) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const row = rows[0];

    if (row.senior_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Only pending and accepted invitations can be revoked
    if (row.status === "revoked") {
      return res.json({ ok: true, status: "revoked" }); // idempotent
    }
    if (row.status !== "pending" && row.status !== "accepted") {
      return res.status(400).json({ error: `Cannot revoke an invitation with status "${row.status}"` });
    }

    await db
      .update(teamInvitations)
      .set({ status: "revoked", revoked_at: new Date(), revoked_reason: reason, updated_at: new Date() })
      .where(eq(teamInvitations.id, id));

    return res.json({ ok: true, status: "revoked" });
  } catch (e) {
    console.error("[onboarding] PATCH /careteam/:id error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /careteam/:id/resend  — resend an expired invitation
// Creates a fresh team_invitations row; original expired row is kept
// for audit history.
// ============================================================

onboardingRouter.post("/careteam/:id/resend", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  const { id } = req.params;

  try {
    const rows = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, id))
      .limit(1);

    if (!rows.length) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const orig = rows[0];

    if (orig.senior_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (orig.status !== "expired") {
      return res.status(400).json({ error: "Only expired invitations can be resent" });
    }

    // Insert a new invitation row; original stays as audit history
    const newToken = crypto.randomUUID();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [newRow] = await db
      .insert(teamInvitations)
      .values({
        senior_id:        orig.senior_id,
        invitee_name:     orig.invitee_name,
        invitee_phone:    orig.invitee_phone,
        invitee_email:    orig.invitee_email,
        invitee_whatsapp: orig.invitee_whatsapp,
        role:             orig.role,
        relationship:     orig.relationship,
        invite_token:     newToken,
        invite_channel:   orig.invite_channel,
        status:           "pending",
        expires_at:       newExpiresAt,
        can_receive_daily_digest:      orig.can_receive_daily_digest,
        can_receive_safety_alerts:     orig.can_receive_safety_alerts,
        can_receive_health_alerts:     orig.can_receive_health_alerts,
        can_receive_mood_alerts:       orig.can_receive_mood_alerts,
        can_receive_medication_alerts: orig.can_receive_medication_alerts,
        can_view_dashboard:            orig.can_view_dashboard,
        can_view_health_reports:       orig.can_view_health_reports,
        can_view_vital_signs:          orig.can_view_vital_signs,
        can_view_journal_summaries:    orig.can_view_journal_summaries,
      })
      .returning({ id: teamInvitations.id });

    return res.json({ ok: true, status: "pending", newId: newRow.id });
  } catch (e) {
    console.error("[onboarding] POST /careteam/:id/resend error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /basics  (Stage 1 → advances to stage_2_preferences)
// No stage prerequisite — this is the entry point.
// Stage regression guard: if the user is already past stage_1,
// we update the fields but do NOT roll the stage backwards.
// ============================================================

const CHANNEL_VALUES = ["email", "in-app", "whatsapp", "sms"] as const;
type ChannelValue = typeof CHANNEL_VALUES[number];

const basicsSchema = z.object({
  full_name:              z.string().min(1, "Name is required"),
  preferred_name:         z.string().nullish(),
  date_of_birth:          z.string().nullish(),
  phone_number:           z.string().optional(),
  language:               z.string().min(1).default("en"),
  email:                  z.string().email().nullish(),
  channel_reports:        z.enum(CHANNEL_VALUES).optional(),
  channel_chats:          z.enum(CHANNEL_VALUES).optional(),
  channel_notifications:  z.enum(CHANNEL_VALUES).optional(),
  hybrid_channel_mode:    z.boolean().optional(),
  facebook_url:           z.string().nullish(),
  instagram_url:          z.string().nullish(),
  whatsapp_number:        z.string().nullish(),
});

onboardingRouter.post("/basics", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  const parsed = basicsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { full_name, preferred_name, date_of_birth, phone_number, language,
          email, channel_reports, channel_chats, channel_notifications, hybrid_channel_mode,
          facebook_url, instagram_url, whatsapp_number } = parsed.data;

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  try {
    // Fetch the current profile so we can preserve the stage if already advanced.
    const existing = await db
      .select({ current_stage: profiles.current_stage })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    const currentStage = existing[0]?.current_stage ?? "stage_1_identity";
    // Only advance to stage_2 if the user hasn't progressed further yet.
    const nextStage: OnboardingStage =
      stageIndex(currentStage) > stageIndex("stage_1_identity")
        ? (currentStage as OnboardingStage)
        : "stage_2_preferences";

    await db
      .insert(profiles)
      .values({
        id:             userId,
        full_name,
        preferred_name:  preferred_name ?? null,
        date_of_birth:   date_of_birth ?? null,
        ...(phone_number           ? { phone_number }           : {}),
        ...(email                  ? { email }                  : {}),
        ...(channel_reports        ? { channel_reports }        : {}),
        ...(channel_chats          ? { channel_chats }          : {}),
        ...(channel_notifications  ? { channel_notifications }  : {}),
        ...(hybrid_channel_mode    !== undefined && { hybrid_channel_mode }),
        ...(facebook_url           ? { facebook_url }           : {}),
        ...(instagram_url          ? { instagram_url }          : {}),
        ...(whatsapp_number        ? { whatsapp_number }        : {}),
        language,
        subscription_status: "trial",
        trial_ends_at:       trialEndsAt,
        current_stage:       "stage_2_preferences",
        stage_1_completed_at: new Date(),
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          full_name,
          ...(preferred_name    !== undefined && { preferred_name }),
          ...(date_of_birth     !== undefined && { date_of_birth }),
          ...(phone_number          ? { phone_number }              : {}),
          ...(email                !== undefined && { email: email ?? null }),
          ...(channel_reports      !== undefined && { channel_reports:       channel_reports      ?? null }),
          ...(channel_chats        !== undefined && { channel_chats:         channel_chats        ?? null }),
          ...(channel_notifications !== undefined && { channel_notifications: channel_notifications ?? null }),
          ...(hybrid_channel_mode  !== undefined && { hybrid_channel_mode }),
          ...(facebook_url         !== undefined && { facebook_url:          facebook_url         ?? null }),
          ...(instagram_url        !== undefined && { instagram_url:         instagram_url        ?? null }),
          ...(whatsapp_number      !== undefined && { whatsapp_number:       whatsapp_number      ?? null }),
          language,
          subscription_status:  "trial",
          trial_ends_at:        trialEndsAt,
          // Preserve stage if already past stage_1.
          current_stage:        nextStage,
          stage_1_completed_at: new Date(),
          updated_at:           new Date(),
        },
      });

    await ensureOnboardingState(userId);

    const fieldsToMark = [
      "has_preferred_name",
      "has_language",
      ...(phone_number ? ["has_phone_number"] : []),
    ];
    await Promise.all(fieldsToMark.map((f) => markField(userId, f)));

    return res.json({ ok: true, trial_ends_at: trialEndsAt });
  } catch (e) {
    console.error("[onboarding] POST /basics error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /channel  (Stage 2 → advances to stage_3_health)
// Prerequisite: basics must be complete (current_stage >= stage_2_preferences)
// ============================================================

const channelSchema = z.object({
  preferred_checkin_channel:      z.string().optional(),
  preferred_conversation_channel: z.string().optional(),
  preferred_reminder_channel:     z.string().optional(),
  preferred_alert_channel:        z.string().optional(),
  voice_available_from:           z.string().optional(),
  voice_available_until:          z.string().optional(),
  whatsapp_available_from:        z.string().optional(),
  whatsapp_available_until:       z.string().optional(),
  // Phone number provided when a voice/WhatsApp outbound channel is selected.
  contact_phone:                  z.string().optional(),
});

onboardingRouter.post("/channel", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  // Gate: basics must be complete (stage_2_preferences) before channel can be set.
  // BasicsStep calls /basics which advances stage to stage_2_preferences before
  // navigating to the channel step, so this gate is safe to enforce.
  const currentStage = await requireStage(userId, "stage_2_preferences", res);
  if (currentStage === null) return;

  const parsed = channelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  try {
    const { contact_phone, ...channelPrefs } = parsed.data;
    const nonEmpty = Object.fromEntries(
      Object.entries(channelPrefs as Record<string, string | undefined>).filter(([, v]) => v !== undefined)
    );

    await db
      .insert(userChannelPreferences)
      .values({ user_id: userId, ...nonEmpty })
      .onConflictDoUpdate({
        target: userChannelPreferences.user_id,
        set: { ...nonEmpty, updated_at: new Date() },
      });

    // Persist contact phone to the profile when provided (voice/WhatsApp outbound channels).
    const checkinChannel = channelPrefs.preferred_checkin_channel;
    if (contact_phone) {
      const profilePhoneFields: Record<string, string> = { phone_number: contact_phone };
      if (checkinChannel === "whatsapp_outbound" || checkinChannel === "whatsapp_text") {
        profilePhoneFields.whatsapp_number = contact_phone;
      }
      await db
        .update(profiles)
        .set({ ...profilePhoneFields, updated_at: new Date() })
        .where(eq(profiles.id, userId));
    }

    // Only advance stage if not already past stage_2.
    if (stageIndex(currentStage) <= stageIndex("stage_2_preferences")) {
      await db
        .update(profiles)
        .set({
          current_stage:        "stage_3_health",
          stage_2_completed_at: new Date(),
          updated_at:           new Date(),
        })
        .where(eq(profiles.id, userId));
    }

    await markField(userId, "has_checkin_preference");

    return res.json({ ok: true });
  } catch (e) {
    console.error("[onboarding] POST /channel error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /proxy  — records a proxy (carer) setting up on the elder's behalf
// ============================================================

const proxySchema = z.object({
  proxy_name: z.string().min(2, "Name must be at least 2 characters"),
});

onboardingRouter.post("/proxy", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  // Gate: user must have started onboarding (profile must exist with at least basics complete).
  const currentStageCheck = await requireStage(userId, "stage_1_identity", res);
  if (currentStageCheck === null) return;

  const parsed = proxySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  try {
    const currentStage = currentStageCheck;

    // NOTE: proxy_initiator_id stores a human-readable display string (e.g. "Maria García (Son / Daughter)")
    // rather than a user ID. This is intentional for the current MVP where the carer does not have
    // their own VYVA account. Future work should migrate to storing carer user ID + separate display fields.
    //
    // In the new signup flow, proxy setup can happen before the elder's basics
    // are entered. In the older channel-step flow, it still replaces channel
    // preferences and advances to the health/consent stage.
    const shouldAdvance =
      stageIndex(currentStage) >= stageIndex("stage_2_preferences") &&
      stageIndex(currentStage) <= stageIndex("stage_2_preferences");

    // Generate a one-time confirmation token stored on the profile.
    // This lets the elder confirm without needing to be logged in — they
    // just tap the link in the SMS.
    const confirmToken = crypto.randomUUID();

    await db
      .insert(profiles)
      .values({
        id:                  userId,
        proxy_initiator_id:  parsed.data.proxy_name,
        proxy_initiated_at:  new Date(),
        onboarding_channel:  "proxy_web",
        elder_confirm_token: confirmToken,
        current_stage:       shouldAdvance ? "stage_3_health" : currentStage,
        stage_2_completed_at: shouldAdvance ? new Date() : undefined,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          proxy_initiator_id:  parsed.data.proxy_name,
          proxy_initiated_at:  new Date(),
          onboarding_channel:  "proxy_web",
          elder_confirm_token: confirmToken,
          ...(shouldAdvance ? {
            current_stage:        "stage_3_health",
            stage_2_completed_at: new Date(),
          } : {}),
          updated_at: new Date(),
        },
      });

    await db
      .update(profileMemberships)
      .set({
        display_name: parsed.data.proxy_name,
        updated_at: new Date(),
      })
      .where(and(
        eq(profileMemberships.user_id, accountUserId),
        eq(profileMemberships.profile_id, userId),
      ));

    // Build the direct confirmation URL for the elder's SMS.
    // Priority: APP_BASE_URL env var, then local development fallback.
    const appBase =
      process.env.APP_BASE_URL ??
      `http://localhost:${process.env.PORT || "5000"}`;
    const confirmUrl = `${appBase}/confirm/${confirmToken}`;

    // Notify the elder that their account has been set up by a proxy.
    // We fetch the latest profile so we have whatever contact info was
    // collected during stage_1_identity (name, phone number).
    try {
      const [elderProfile] = await db
        .select({ full_name: profiles.full_name, phone_number: profiles.phone_number })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      await notifyElderOfProxySetup({
        elderId:    userId,
        elderName:  elderProfile?.full_name ?? null,
        elderPhone: elderProfile?.phone_number ?? null,
        // elderEmail is not yet stored in the profiles table — it lives in the
        // auth provider. Pass null until JWT/session auth exposes it here.
        elderEmail: null,
        proxyName:  parsed.data.proxy_name,
        confirmUrl,
      });
    } catch (notifyErr) {
      // Never block the main response for a notification failure.
      console.error("[onboarding] POST /proxy — notification error (non-fatal):", notifyErr);
    }

    return res.json({
      ok: true,
      confirmUrl,
      nextRoute: shouldAdvance ? "/onboarding/elder-confirm" : "/onboarding/basics",
    });
  } catch (e) {
    console.error("[onboarding] POST /proxy error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// GET /confirm/:token  — tokenized elder confirm (no JWT required)
//   Returns the proxy name and whether already confirmed so the
//   frontend can render the confirmation screen.
// ============================================================

onboardingRouter.get("/confirm/:token", async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const [row] = await db
      .select({
        id:                  profiles.id,
        full_name:           profiles.full_name,
        proxy_initiator_id:  profiles.proxy_initiator_id,
        elder_confirmed_at:  profiles.elder_confirmed_at,
      })
      .from(profiles)
      .where(eq(profiles.elder_confirm_token, token))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "Invalid or expired confirmation link" });
    }

    return res.json({
      alreadyConfirmed: !!row.elder_confirmed_at,
      elderName:        row.full_name ?? null,
      proxyName:        row.proxy_initiator_id ?? null,
    });
  } catch (e) {
    console.error("[onboarding] GET /confirm/:token error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /confirm/:token  — tokenized elder confirm (no JWT required)
//   Sets elder_confirmed_at and clears the token (single-use).
// ============================================================

onboardingRouter.post("/confirm/:token", async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const [row] = await db
      .select({ id: profiles.id, elder_confirmed_at: profiles.elder_confirmed_at })
      .from(profiles)
      .where(eq(profiles.elder_confirm_token, token))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "Invalid or expired confirmation link" });
    }

    if (row.elder_confirmed_at) {
      // Already confirmed — idempotent
      return res.json({ ok: true, alreadyConfirmed: true });
    }

    // Mark confirmed and clear the single-use token
    await db
      .update(profiles)
      .set({
        elder_confirmed_at:  new Date(),
        elder_confirm_token: null,
        updated_at:          new Date(),
      })
      .where(eq(profiles.id, row.id));

    return res.json({ ok: true, alreadyConfirmed: false });
  } catch (e) {
    console.error("[onboarding] POST /confirm/:token error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /elder-confirm  — elder confirms a proxy-initiated account
// ============================================================

onboardingRouter.post("/elder-confirm", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  try {
    // Guard: only allow elder confirmation on accounts that were actually set up by a proxy.
    const [existingProfile] = await db
      .select({ proxy_initiator_id: profiles.proxy_initiator_id })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!existingProfile?.proxy_initiator_id) {
      return res.status(400).json({
        error: "No proxy-initiated profile found",
        message: "Elder confirmation is only applicable to accounts set up by a carer.",
      });
    }

    await db
      .update(profiles)
      .set({ elder_confirmed_at: new Date(), updated_at: new Date() })
      .where(eq(profiles.id, userId));

    return res.json({ ok: true });
  } catch (e) {
    console.error("[onboarding] POST /elder-confirm error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /consent  (Stage 5 → advances to complete)
// Prerequisite: current_stage >= stage_3_health (channel step complete).
//
// NOTE on gating level: The full stage model includes stage_4_care_team
// and stage_5_consent between stage_3_health and complete, but no server
// routes currently advance the user through those intermediate stages —
// that work is tracked separately. Until explicit stage-4/5 advancement
// routes exist, gating at stage_3_health is the correct and intentional
// minimum: it prevents a user from skipping basics + channel entirely,
// while not blocking users who have completed health sections via the
// exempt /section/:sectionId routes. Tighten this gate once stage_4 and
// stage_5 advancement routes are in place.
// ============================================================

const consentEntrySchema = z.object({
  scope:               z.string(),
  action:              z.string(),
  channel:             z.string(),
  target_user_id:      z.string().optional(),
  target_name:         z.string().optional(),
  target_role:         z.string().optional(),
  confirmed_by_elder:  z.boolean().optional(),
  confirmation_method: z.string().optional(),
});

const consentSchema = z.object({
  entries:       z.array(consentEntrySchema).min(1),
  skip_advance:  z.boolean().optional(),
});

onboardingRouter.post("/consent", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  // Gate: channel preferences (stage_2) must be complete before submitting consent.
  const currentStage = await requireStage(userId, "stage_3_health", res);
  if (currentStage === null) return;

  // Gate: proxy-initiated accounts must be confirmed by the elder before consent can be recorded.
  const [userProfile] = await db
    .select({ proxy_initiator_id: profiles.proxy_initiator_id, elder_confirmed_at: profiles.elder_confirmed_at })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (userProfile?.proxy_initiator_id && !userProfile?.elder_confirmed_at) {
    return res.status(403).json({
      error: "Elder confirmation required",
      code: "ELDER_CONFIRMATION_REQUIRED",
      message: "This account was set up on someone's behalf. The account holder must confirm it before consenting.",
    });
  }

  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { entries, skip_advance } = parsed.data;

  try {
    for (const entry of entries) {
      await db.insert(consentLog).values({
        user_id: userId,
        scope:   entry.scope as typeof consentLog.$inferInsert["scope"],
        action:  entry.action as typeof consentLog.$inferInsert["action"],
        channel: entry.channel as typeof consentLog.$inferInsert["channel"],
        target_user_id:      entry.target_user_id ?? null,
        target_name:         entry.target_name ?? null,
        target_role:         (entry.target_role ?? null) as typeof consentLog.$inferInsert["target_role"],
        confirmed_by_elder:  entry.confirmed_by_elder ?? true,
        confirmation_method: entry.confirmation_method ?? null,
      });
    }

    if (!skip_advance) {
      await db
        .update(profiles)
        .set({
          current_stage:        "complete",
          onboarding_complete:  true,
          stage_5_completed_at: new Date(),
          updated_at:           new Date(),
        })
        .where(eq(profiles.id, userId));
    }

    return res.json({ ok: true, inserted: entries.length });
  } catch (e) {
    console.error("[onboarding] POST /consent error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /field  (Exempt from stage checks — used mid-conversation)
// ============================================================

const fieldSchema = z.object({
  field: z.string(),
});

onboardingRouter.post("/field", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  const parsed = fieldSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { field } = parsed.data;

  try {
    await ensureOnboardingState(userId);
    await markField(userId, field);
    return res.json({ ok: true, field });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Unknown field:")) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[onboarding] POST /field error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /section/:sectionId  (Exempt — used mid-conversation)
// ============================================================

const sectionSchemas: Record<string, z.ZodTypeAny> = {
  medications: z.object({
    medications: z.array(z.object({
      medication_name: z.string(),
      dosage:          z.string().optional(),
      frequency:       z.string().optional(),
      scheduled_times: z.array(z.string()).optional(),
    })).optional(),
    known_allergies: z.array(z.string()).optional(),
  }),
  conditions: z.object({
    health_conditions: z.array(z.string()).optional(),
  }),
  cognitive: z.object({
    cognitive_notes: z.string().optional(),
  }),
  diet: z.object({
    dietary_notes:      z.string().optional(),
    dietary_preferences: z.array(z.string()).optional(),
  }),
  address: z.object({
    address_line_1: z.string().optional(),
    city:           z.string().optional(),
    region:         z.string().optional(),
    postcode:       z.string().optional(),
    country_code:   z.string().optional(),
    timezone:       z.string().optional(),
  }),
  gp: z.object({
    gp_name:     z.string().optional(),
    gp_phone:    z.string().optional(),
    gp_address:  z.string().optional(),
    gp_maps_url: z.string().optional(),
    gp_place_id: z.string().optional(),
  }),
  devices: z.object({
    devices: z.array(z.string()).optional(),
  }),
  hobbies: z.object({
    hobbies: z.array(z.string()).optional(),
    followUps: z.record(z.string(), z.string()).optional(),
    personality: z.record(z.string(), z.string()).optional(),
  }),
  providers: z.object({
    providers: z.array(z.object({
      name:             z.string(),
      role:             z.string().optional(),
      phone:            z.string().optional(),
      google_maps_url:  z.string().optional(),
      google_place_id:  z.string().optional(),
      address:          z.string().optional(),
      lat:              z.number().optional(),
      lng:              z.number().optional(),
      website_uri:      z.string().optional(),
      opening_hours:    z.array(z.string()).optional(),
      contact_name:     z.string().optional(),
      contact_role:     z.string().optional(),
      contact_phone:    z.string().optional(),
      usual_order:      z.string().optional(),
      special_requests: z.string().optional(),
      online_order_url: z.string().optional(),
      menu_url:         z.string().optional(),
      notes:            z.string().optional(),
    })).optional(),
  }),
  emergency: z.object({
    emergency_name:  z.string().optional(),
    emergency_phone: z.string().optional(),
    emergency_role:  z.string().optional(),
  }),
  careteam: z.object({
    role:           z.enum(["family", "carer", "doctor"]),
    person: z.object({
      name:         z.string(),
      relationship: z.string().optional(),
      phone:        z.string().optional(),
      whatsapp:     z.string().optional(),
      email:        z.string().optional(),
    }),
    consent: z.object({
      // Fields that map directly to team_invitations columns:
      daily_summary:       z.boolean().optional(), // → can_receive_daily_digest
      mood_updates:        z.boolean().optional(), // → can_receive_mood_alerts
      medication_alerts:   z.boolean().optional(), // → can_receive_medication_alerts
      health_reports:      z.boolean().optional(), // → can_receive_health_alerts + can_view_health_reports
      vital_signs:         z.boolean().optional(), // → can_view_vital_signs
      cognitive_results:   z.boolean().optional(), // → can_view_journal_summaries
      emergency_alerts:    z.boolean().optional(), // → can_receive_safety_alerts
      dashboard_access:    z.boolean().optional(), // → can_view_dashboard
      // NOTE: "appointments" and "inactivity_alerts" shown in the UI are not
      // yet persisted — team_invitations has no column for them. They are
      // silently dropped here until dedicated columns are added.
    }).optional(),
    // NOTE: "sms" is mapped to the nearest supported enum value "whatsapp_text"
    // (true SMS channel is not yet available). Logged here for future reference.
    invite_channel: z.enum(["whatsapp", "sms"]).optional(),
  }),
};

const SECTION_FIELD_MAP: Record<string, string[]> = {
  medications: ["has_medications"],
  conditions:  ["has_health_conditions"],
  cognitive:   [],
  diet:        [],
  address:     ["has_emergency_address", "has_location"],
  gp:          ["has_gp_details"],
  devices:     [],
  hobbies:     [],
  providers:   [],
  emergency:   ["has_emergency_address"],
  careteam:    [],
};

const CARETEAM_ROLE_MAP: Record<string, "caregiver" | "family_member" | "friend" | "doctor" | "gp"> = {
  family: "family_member",
  carer:  "caregiver",
  doctor: "doctor",
};

const CARETEAM_ONBOARDING_FIELD: Record<string, string> = {
  family: "has_family_member",
  carer:  "has_caregiver",
  doctor: "has_doctor",
};

async function mergeSectionIntoConsent(
  userId: string,
  sectionKey: string,
  payload: Record<string, unknown>
): Promise<void> {
  const profileRows = await db
    .select({ data_sharing_consent: profiles.data_sharing_consent })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  const existing = (profileRows[0]?.data_sharing_consent as Record<string, unknown> | null) ?? {};
  const merged = { ...existing, [sectionKey]: payload };

  await db
    .update(profiles)
    .set({ data_sharing_consent: merged, updated_at: new Date() })
    .where(eq(profiles.id, userId));
}

onboardingRouter.post("/section/:sectionId", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  const { sectionId } = req.params;

  if (!sectionSchemas[sectionId]) {
    return res.status(400).json({ error: `Unknown section: ${sectionId}` });
  }

  const parsed = sectionSchemas[sectionId].safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const data = parsed.data as Record<string, unknown>;

  try {
    await ensureOnboardingState(userId);

    if (sectionId === "medications") {
      if (Array.isArray(data.known_allergies)) {
        await db
          .update(profiles)
          .set({ known_allergies: data.known_allergies as string[], updated_at: new Date() })
          .where(eq(profiles.id, userId));
      }

      const meds = data.medications as Array<{
        medication_name: string;
        dosage?: string;
        frequency?: string;
        scheduled_times?: string[];
      }> | undefined;

      if (Array.isArray(meds) && meds.length > 0) {
        await db.insert(userMedications).values(
          meds.map((m) => ({
            user_id:         userId,
            medication_name: m.medication_name,
            dosage:          m.dosage ?? null,
            frequency:       m.frequency ?? null,
            scheduled_times: m.scheduled_times ?? null,
            added_by:        "onboarding",
          }))
        );

        await markField(userId, "has_medications");
      }

      if (Array.isArray(data.known_allergies) && (data.known_allergies as string[]).length > 0) {
        await markField(userId, "has_allergies");
      }
    } else if (sectionId === "address") {
      const profileUpdates: Record<string, unknown> = { updated_at: new Date() };
      if (data.address_line_1) profileUpdates.address_line_1 = data.address_line_1;
      if (data.city)           profileUpdates.city           = data.city;
      if (data.region)         profileUpdates.region         = data.region;
      if (data.postcode)       profileUpdates.postcode       = data.postcode;
      if (data.country_code)   profileUpdates.country_code   = data.country_code;
      if (data.timezone)       profileUpdates.timezone       = data.timezone;

      await db.update(profiles).set(profileUpdates).where(eq(profiles.id, userId));

      const fieldsToMark = SECTION_FIELD_MAP["address"];
      await Promise.all(fieldsToMark.map((f) => markField(userId, f)));
    } else if (sectionId === "gp") {
      const profileUpdates: Record<string, unknown> = { updated_at: new Date() };
      if (data.gp_name     !== undefined) profileUpdates.gp_name     = data.gp_name;
      if (data.gp_phone    !== undefined) profileUpdates.gp_phone    = data.gp_phone;
      if (data.gp_address  !== undefined) profileUpdates.gp_address  = data.gp_address;
      if (data.gp_maps_url !== undefined) profileUpdates.gp_maps_url = data.gp_maps_url;
      if (data.gp_place_id !== undefined) profileUpdates.gp_place_id = data.gp_place_id;

      await db.update(profiles).set(profileUpdates).where(eq(profiles.id, userId));
      await markField(userId, "has_gp_details");
    } else if (sectionId === "careteam") {
      const ct = data as {
        role: "family" | "carer" | "doctor";
        person: { name: string; relationship?: string; phone?: string; whatsapp?: string; email?: string };
        consent?: Record<string, boolean>;
        invite_channel?: "whatsapp" | "sms";
      };

      const mappedRole = CARETEAM_ROLE_MAP[ct.role];
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const inviteToken = crypto.randomUUID();

      const inviteChannel = ct.invite_channel === "sms"
        ? ("whatsapp_text" as const)
        : ("whatsapp_outbound" as const);

      const consent = ct.consent ?? {};

      await db.insert(teamInvitations).values({
        senior_id:        userId,
        invitee_name:     ct.person.name,
        invitee_phone:    ct.person.phone ?? null,
        invitee_email:    ct.person.email ?? null,
        invitee_whatsapp: ct.person.whatsapp ?? null,
        role:             mappedRole,
        relationship:     ct.person.relationship ?? null,
        invite_token:     inviteToken,
        invite_channel:   inviteChannel,
        status:           "pending",
        expires_at:       expiresAt,

        can_receive_daily_digest:      consent.daily_summary      ?? true,
        can_receive_safety_alerts:     consent.emergency_alerts   ?? true,
        can_receive_health_alerts:     consent.health_reports     ?? false,
        can_receive_mood_alerts:       consent.mood_updates       ?? false,
        can_receive_medication_alerts: consent.medication_alerts  ?? false,
        can_view_dashboard:            consent.dashboard_access   ?? false,
        can_view_health_reports:       consent.health_reports     ?? false,
        can_view_vital_signs:          consent.vital_signs        ?? false,
        can_view_journal_summaries:    consent.cognitive_results  ?? false,
      });

      const fieldToMark = CARETEAM_ONBOARDING_FIELD[ct.role];
      if (fieldToMark) await markField(userId, fieldToMark);
    } else {
      await mergeSectionIntoConsent(userId, sectionId, data);

      const fieldsToMark = SECTION_FIELD_MAP[sectionId] ?? [];
      if (fieldsToMark.length > 0) {
        await Promise.all(fieldsToMark.map((f) => markField(userId, f)));
      }
    }

    return res.json({ ok: true, section: sectionId });
  } catch (e) {
    console.error(`[onboarding] POST /section/${sectionId} error:`, e);
    return res.status(500).json({ error: "Internal server error" });
  }
});
