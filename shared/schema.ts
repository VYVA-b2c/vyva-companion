// ============================================================
// VYVA — Complete Schema (schema.ts)
// ============================================================
// EXISTING TABLES: preserved exactly as-is (profiles,
// session_state, session_exchanges, agent_difficulty,
// caregiver_alerts, medication_adherence, user_medications)
//
// NEW ADDITIONS:
//   - profiles: onboarding fields added
//   - session_state: channel + context_snapshot added
//   - onboarding_state: feature flags, stage tracking, nudges
//   - consent_log: append-only GDPR audit trail
//   - team_invitations: care team invite lifecycle
//   - user_channel_identity: multi-channel identity map
//   - user_channel_preferences: per-user channel settings
//   - inbound_number_routing: local number → deployment map
//
// NOTE: profiles.id is TEXT (external auth provider ID).
// All foreign keys use TEXT to match. No UUIDs for user references.
// ============================================================

import {
  pgTable, pgEnum, unique,
  text, integer, boolean, real, timestamp, uuid, jsonb
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";


// ============================================================
// ENUMS
// ============================================================

export const onboardingStageEnum = pgEnum("onboarding_stage", [
  "stage_1_identity",
  "stage_2_preferences",
  "stage_3_health",
  "stage_4_care_team",
  "stage_5_consent",
  "complete",
]);

export const onboardingChannelEnum = pgEnum("onboarding_channel", [
  "voice",
  "web_form",
  "whatsapp",
  "proxy_web",
  "admin_template",
]);

export const channelTypeEnum = pgEnum("channel_type", [
  "voice_app",
  "voice_inbound",
  "voice_outbound",
  "whatsapp_text",
  "whatsapp_voice",
  "whatsapp_outbound",
  "web_form",
  "admin_template",
]);

export const consentActionEnum = pgEnum("consent_action", [
  "granted",
  "denied",
  "revoked",
  "updated",
]);

export const consentScopeEnum = pgEnum("consent_scope", [
  "health_conditions",
  "medications",
  "allergies",
  "gp_details",
  "vital_signs",
  "mood_and_journal",
  "location",
  "conversation_summary",
  "caregiver_full_access",
  "caregiver_health_alerts",
  "caregiver_mood_alerts",
  "caregiver_medication_alerts",
  "caregiver_safety_alerts",
  "family_wellbeing_summary",
  "family_health_detail",
  "doctor_health_reports",
  "doctor_vital_summaries",
  "fall_detection",
  "emergency_location_share",
  "whatsapp_notifications",
  "daily_digest_to_caregiver",
]);

export const teamRoleEnum = pgEnum("team_role", [
  "caregiver",
  "family_member",
  "friend",
  "doctor",
  "gp",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
  "revoked",
  "expired",
]);

export const lifecycleEntryPointEnum = pgEnum("lifecycle_entry_point", [
  "form",
  "phone",
  "whatsapp",
  "admin",
]);

export const lifecycleUserTypeEnum = pgEnum("lifecycle_user_type", [
  "elder",
  "family",
  "admin",
]);

export const lifecycleStatusEnum = pgEnum("lifecycle_status", [
  "created",
  "link_sent",
  "consent_pending",
  "active",
  "dropped",
]);

export const accessLinkTypeEnum = pgEnum("access_link_type", [
  "trial",
  "unlimited",
  "organization",
  "custom",
  "caregiver",
]);

export const consentAttemptStatusEnum = pgEnum("consent_attempt_status", [
  "pending",
  "approved",
  "rejected",
  "no_answer",
  "failed",
]);


// ============================================================
// AUTH TABLE: users — email/password accounts
// ============================================================

export const users = pgTable("users", {
  id:                    text("id").primaryKey().default(sql`gen_random_uuid()`),
  email:                 text("email").notNull().unique(),
  password_hash:         text("password_hash").notNull(),
  reset_token:           text("reset_token"),
  reset_token_expires_at: timestamp("reset_token_expires_at", { withTimezone: true }),
  last_seen_at:          timestamp("last_seen_at", { withTimezone: true }),
  created_at:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, created_at: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;


// ============================================================
// AUTH TABLE: password_reset_tokens — one-time reset tokens
// ============================================================

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id:         text("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token:      text("token").notNull().unique(),
  used:       boolean("used").notNull().default(false),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;


// ============================================================
// EXISTING TABLE: profiles — extended, all new columns nullable
// ============================================================

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),

  // Existing
  full_name:              text("full_name"),
  date_of_birth:          text("date_of_birth"),
  language:               text("language").notNull().default("en"),
  deployment:             text("deployment").notNull().default("standard"),
  mem0_user_id:           text("mem0_user_id"),
  stripe_customer_id:     text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  subscription_status:    text("subscription_status").notNull().default("trial"),
  subscription_tier:      text("subscription_tier").notNull().default("free"),
  trial_ends_at:          timestamp("trial_ends_at", { withTimezone: true }),
  account_status:         text("account_status").notNull().default("enabled"),
  role:                   text("role").notNull().default("user"),
  disabled_at:            timestamp("disabled_at", { withTimezone: true }),
  disabled_reason:        text("disabled_reason"),
  disabled_by:            text("disabled_by"),

  // New: identity
  preferred_name:         text("preferred_name"),
  avatar_url:             text("avatar_url"),
  phone_number:           text("phone_number"),
  email:                  text("email"),
  whatsapp_number:        text("whatsapp_number"),
  contact_method:         text("contact_method"),
  channel_reports:        text("channel_reports").default("email"),
  channel_chats:          text("channel_chats").default("in-app"),
  channel_notifications:  text("channel_notifications").default("whatsapp"),
  hybrid_channel_mode:    boolean("hybrid_channel_mode").default(false),
  facebook_url:           text("facebook_url"),
  instagram_url:          text("instagram_url"),
  country_code:           text("country_code").default("ES"),
  timezone:               text("timezone").default("Europe/Madrid"),

  // New: onboarding journey
  current_stage:          onboardingStageEnum("current_stage").default("stage_1_identity"),
  onboarding_channel:     onboardingChannelEnum("onboarding_channel"),
  proxy_initiator_id:     text("proxy_initiator_id"),
  proxy_initiated_at:     timestamp("proxy_initiated_at", { withTimezone: true }),
  elder_confirm_token:    text("elder_confirm_token").unique(),
  elder_confirmed_at:     timestamp("elder_confirmed_at", { withTimezone: true }),
  onboarding_complete:    boolean("onboarding_complete").notNull().default(false),
  stage_1_completed_at:   timestamp("stage_1_completed_at", { withTimezone: true }),
  stage_2_completed_at:   timestamp("stage_2_completed_at", { withTimezone: true }),
  stage_3_completed_at:   timestamp("stage_3_completed_at", { withTimezone: true }),
  stage_4_completed_at:   timestamp("stage_4_completed_at", { withTimezone: true }),
  stage_5_completed_at:   timestamp("stage_5_completed_at", { withTimezone: true }),

  // New: location
  address_line_1:         text("address_line_1"),
  city:                   text("city"),
  region:                 text("region"),
  postcode:               text("postcode"),

  // New: caregiver contact (from settings form)
  caregiver_name:         text("caregiver_name"),
  caregiver_contact:      text("caregiver_contact"),

  // New: health context
  gp_name:                text("gp_name"),
  gp_phone:               text("gp_phone"),
  gp_address:             text("gp_address"),
  gp_maps_url:            text("gp_maps_url"),
  gp_place_id:            text("gp_place_id"),
  known_allergies:        text("known_allergies").array(),

  // New: social activation
  social_enabled:         boolean("social_enabled").default(false),
  discoverable:           boolean("discoverable").default(false),
  match_opt_in:           boolean("match_opt_in").default(false),
  group_opt_in:           boolean("group_opt_in").default(false),

  // New: consent cache
  data_sharing_consent:   jsonb("data_sharing_consent").default({}),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({ created_at: true, updated_at: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;


// ============================================================
// EXISTING TABLE: session_state — extended with channel fields
// ============================================================

export const sessionState = pgTable("session_state", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  user_id:              text("user_id").notNull(),
  session_id:           text("session_id").notNull().unique(),

  // Existing
  current_agent:        text("current_agent").notNull().default("companion"),
  last_agent:           text("last_agent"),
  last_intent:          text("last_intent"),
  last_activity_at:     timestamp("last_activity_at", { withTimezone: true }),
  turn_count:           integer("turn_count").notNull().default(0),
  next_agent_override:  text("next_agent_override"),

  // New: channel tracking
  channel:              channelTypeEnum("channel").default("voice_app"),
  previous_channel:     channelTypeEnum("previous_channel"),
  channel_switched:     boolean("channel_switched").default(false),

  // New: context handoff snapshot
  // Written at end of session, read at start of next (any channel)
  context_snapshot:     jsonb("context_snapshot").default({}),

  // New: identity resolution
  resolved_by:          text("resolved_by"),
  was_unregistered:     boolean("was_unregistered").default(false),
  onboarding_triggered: boolean("onboarding_triggered").default(false),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionStateSchema = createInsertSchema(sessionState).omit({ id: true, created_at: true, updated_at: true });
export type InsertSessionState = z.infer<typeof insertSessionStateSchema>;
export type SessionState = typeof sessionState.$inferSelect;


// ============================================================
// EXISTING TABLES — unchanged
// ============================================================

export const sessionExchanges = pgTable("session_exchanges", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  session_id:           text("session_id").notNull(),
  user_id:              text("user_id").notNull(),
  speaker:              text("speaker").notNull(),
  message:              text("message").notNull(),
  agent_used:           text("agent_used"),
  intent_classified:    text("intent_classified"),
  intent_confidence:    real("intent_confidence"),
  created_at:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionExchangeSchema = createInsertSchema(sessionExchanges).omit({ id: true, created_at: true });
export type InsertSessionExchange = z.infer<typeof insertSessionExchangeSchema>;
export type SessionExchange = typeof sessionExchanges.$inferSelect;

export const agentDifficulty = pgTable("agent_difficulty", {
  id:                uuid("id").primaryKey().defaultRandom(),
  user_id:           text("user_id").notNull(),
  agent_name:        text("agent_name").notNull(),
  difficulty_level:  integer("difficulty_level").notNull().default(1),
  sessions_at_level: integer("sessions_at_level").notNull().default(0),
  last_score:        real("last_score"),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentDifficultySchema = createInsertSchema(agentDifficulty).omit({ id: true, updated_at: true });
export type InsertAgentDifficulty = z.infer<typeof insertAgentDifficultySchema>;
export type AgentDifficulty = typeof agentDifficulty.$inferSelect;

export const caregiverAlerts = pgTable("caregiver_alerts", {
  id:          uuid("id").primaryKey().defaultRandom(),
  user_id:     text("user_id").notNull(),
  alert_type:  text("alert_type").notNull(),
  severity:    text("severity").notNull(),
  message:     text("message").notNull(),
  sent_to:     text("sent_to").array(),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
  resolved_by: text("resolved_by"),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCaregiverAlertSchema = createInsertSchema(caregiverAlerts).omit({ id: true, created_at: true });
export type InsertCaregiverAlert = z.infer<typeof insertCaregiverAlertSchema>;
export type CaregiverAlert = typeof caregiverAlerts.$inferSelect;

export const medicationAdherence = pgTable("medication_adherence", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  user_id:            text("user_id").notNull(),
  medication_name:    text("medication_name").notNull(),
  scheduled_time:     text("scheduled_time").notNull(),
  status:             text("status").notNull(),
  confirmed_by:       text("confirmed_by").notNull().default("user"),
  confirmed_taken_at: timestamp("confirmed_taken_at", { withTimezone: true }),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationAdherenceSchema = createInsertSchema(medicationAdherence).omit({ id: true, created_at: true });
export type InsertMedicationAdherence = z.infer<typeof insertMedicationAdherenceSchema>;
export type MedicationAdherence = typeof medicationAdherence.$inferSelect;

export const userMedications = pgTable("user_medications", {
  id:              uuid("id").primaryKey().defaultRandom(),
  user_id:         text("user_id").notNull(),
  medication_name: text("medication_name").notNull(),
  dosage:          text("dosage"),
  frequency:       text("frequency"),
  scheduled_times: text("scheduled_times").array(),
  active:          boolean("active").notNull().default(true),
  added_by:        text("added_by").notNull().default("user"),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserMedicationSchema = createInsertSchema(userMedications).omit({ id: true, created_at: true });
export type InsertUserMedication = z.infer<typeof insertUserMedicationSchema>;
export type UserMedication = typeof userMedications.$inferSelect;


// ============================================================
// NEW TABLE: activity_logs — persisted movement entries
// ============================================================

export const activityLogs = pgTable("activity_logs", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id").notNull(),
  activity_type:    text("activity_type").notNull(),
  duration_minutes: integer("duration_minutes").notNull(),
  calories:         integer("calories").notNull().default(0),
  logged_at:        timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, logged_at: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;


// ============================================================
// NEW TABLE: daily_step_logs — manually logged daily step counts
// ============================================================

export const dailyStepLogs = pgTable("daily_step_logs", {
  id:         uuid("id").primaryKey().defaultRandom(),
  user_id:    text("user_id").notNull(),
  log_date:   text("log_date").notNull(),
  steps:      integer("steps").notNull().default(0),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("daily_step_logs_user_date_unique").on(t.user_id, t.log_date),
]);

export const insertDailyStepLogSchema = createInsertSchema(dailyStepLogs).omit({ id: true, updated_at: true });
export type InsertDailyStepLog = z.infer<typeof insertDailyStepLogSchema>;
export type DailyStepLog = typeof dailyStepLogs.$inferSelect;


// ============================================================
// NEW TABLE: onboarding_state
// ============================================================

export const onboardingState = pgTable("onboarding_state", {
  id:         uuid("id").primaryKey().defaultRandom(),
  user_id:    text("user_id").notNull().unique(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  // Stage 1 — minimum to start
  has_preferred_name:     boolean("has_preferred_name").notNull().default(false),
  has_phone_number:       boolean("has_phone_number").notNull().default(false),
  has_language:           boolean("has_language").notNull().default(false),

  // Stage 2 — collected conversationally
  has_date_of_birth:      boolean("has_date_of_birth").notNull().default(false),
  has_emergency_address:  boolean("has_emergency_address").notNull().default(false),
  has_checkin_preference: boolean("has_checkin_preference").notNull().default(false),
  has_location:           boolean("has_location").notNull().default(false),

  // Stage 3 — health profile, elder-led
  has_health_conditions:  boolean("has_health_conditions").notNull().default(false),
  has_medications:        boolean("has_medications").notNull().default(false),
  has_allergies:          boolean("has_allergies").notNull().default(false),
  has_gp_details:         boolean("has_gp_details").notNull().default(false),

  // Stage 4 — care team
  has_caregiver:          boolean("has_caregiver").notNull().default(false),
  has_family_member:      boolean("has_family_member").notNull().default(false),
  has_doctor:             boolean("has_doctor").notNull().default(false),

  // Features unlocked — updated by API when flags change
  feature_companionship:    boolean("feature_companionship").notNull().default(true),
  feature_brain_training:   boolean("feature_brain_training").notNull().default(true),
  feature_daily_checkin:    boolean("feature_daily_checkin").notNull().default(true),
  feature_medication_mgmt:  boolean("feature_medication_mgmt").notNull().default(false),
  feature_vital_scan:       boolean("feature_vital_scan").notNull().default(false),
  feature_health_research:  boolean("feature_health_research").notNull().default(false),
  feature_nutrition_coach:  boolean("feature_nutrition_coach").notNull().default(false),
  feature_safety_agent:     boolean("feature_safety_agent").notNull().default(false),
  feature_fall_detection:   boolean("feature_fall_detection").notNull().default(false),
  feature_concierge:        boolean("feature_concierge").notNull().default(false),
  feature_caregiver_alerts: boolean("feature_caregiver_alerts").notNull().default(false),

  // Nudge cooldowns — prevent repeating the same suggestion
  nudge_dob_sent_at:         timestamp("nudge_dob_sent_at", { withTimezone: true }),
  nudge_address_sent_at:     timestamp("nudge_address_sent_at", { withTimezone: true }),
  nudge_medications_sent_at: timestamp("nudge_medications_sent_at", { withTimezone: true }),
  nudge_health_sent_at:      timestamp("nudge_health_sent_at", { withTimezone: true }),
  nudge_caregiver_sent_at:   timestamp("nudge_caregiver_sent_at", { withTimezone: true }),

  // How each stage was completed
  stage_1_channel: onboardingChannelEnum("stage_1_channel"),
  stage_2_channel: onboardingChannelEnum("stage_2_channel"),
  stage_3_channel: onboardingChannelEnum("stage_3_channel"),
  stage_4_channel: onboardingChannelEnum("stage_4_channel"),
  stage_5_channel: onboardingChannelEnum("stage_5_channel"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOnboardingStateSchema = createInsertSchema(onboardingState).omit({ id: true, created_at: true, updated_at: true });
export type InsertOnboardingState = z.infer<typeof insertOnboardingStateSchema>;
export type OnboardingState = typeof onboardingState.$inferSelect;


// ============================================================
// NEW TABLE: consent_log — append-only GDPR audit trail
// ============================================================

export const consentLog = pgTable("consent_log", {
  id:         uuid("id").primaryKey().defaultRandom(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  user_id:        text("user_id").notNull(),
  scope:          consentScopeEnum("scope").notNull(),
  action:         consentActionEnum("action").notNull(),
  target_user_id: text("target_user_id"),
  target_name:    text("target_name"),
  target_role:    teamRoleEnum("target_role"),

  channel:             onboardingChannelEnum("channel").notNull(),
  confirmed_by_elder:  boolean("confirmed_by_elder").notNull().default(true),
  confirmation_method: text("confirmation_method"),
});

export const insertConsentLogSchema = createInsertSchema(consentLog).omit({ id: true, created_at: true });
export type InsertConsentLog = z.infer<typeof insertConsentLogSchema>;
export type ConsentLog = typeof consentLog.$inferSelect;


// ============================================================
// NEW TABLE: team_invitations
// ============================================================

export const teamInvitations = pgTable("team_invitations", {
  id:         uuid("id").primaryKey().defaultRandom(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  senior_id:         text("senior_id").notNull(),
  invitee_name:      text("invitee_name").notNull(),
  invitee_phone:     text("invitee_phone"),
  invitee_email:     text("invitee_email"),
  invitee_whatsapp:  text("invitee_whatsapp"),
  role:              teamRoleEnum("role").notNull(),
  relationship:      text("relationship"),

  invite_token:   text("invite_token").notNull().unique(),
  invite_channel: channelTypeEnum("invite_channel").notNull().default("whatsapp_outbound"),
  status:         invitationStatusEnum("status").notNull().default("pending"),
  expires_at:     timestamp("expires_at", { withTimezone: true }).notNull(),

  accepted_at:      timestamp("accepted_at", { withTimezone: true }),
  accepted_user_id: text("accepted_user_id"),
  revoked_at:       timestamp("revoked_at", { withTimezone: true }),
  revoked_reason:   text("revoked_reason"),

  can_receive_daily_digest:      boolean("can_receive_daily_digest").notNull().default(true),
  can_receive_safety_alerts:     boolean("can_receive_safety_alerts").notNull().default(true),
  can_receive_health_alerts:     boolean("can_receive_health_alerts").notNull().default(false),
  can_receive_mood_alerts:       boolean("can_receive_mood_alerts").notNull().default(false),
  can_receive_medication_alerts: boolean("can_receive_medication_alerts").notNull().default(false),
  can_view_dashboard:            boolean("can_view_dashboard").notNull().default(false),
  can_view_health_reports:       boolean("can_view_health_reports").notNull().default(false),
  can_view_vital_signs:          boolean("can_view_vital_signs").notNull().default(false),
  can_view_journal_summaries:    boolean("can_view_journal_summaries").notNull().default(false),
});

export const insertTeamInvitationSchema = createInsertSchema(teamInvitations).omit({ id: true, created_at: true, updated_at: true });
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
export type TeamInvitation = typeof teamInvitations.$inferSelect;


// ============================================================
// NEW TABLE: user_channel_identity
// ============================================================

export const userChannelIdentity = pgTable("user_channel_identity", {
  id:         uuid("id").primaryKey().defaultRandom(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  user_id:     text("user_id").notNull(),
  channel:     channelTypeEnum("channel").notNull(),
  identifier:  text("identifier").notNull(),
  label:       text("label"),

  is_primary:          boolean("is_primary").notNull().default(false),
  is_verified:         boolean("is_verified").notNull().default(false),
  verified_at:         timestamp("verified_at", { withTimezone: true }),
  verification_method: text("verification_method"),

  is_proxy:       boolean("is_proxy").notNull().default(false),
  proxy_owner_id: text("proxy_owner_id"),
});

export const insertUserChannelIdentitySchema = createInsertSchema(userChannelIdentity).omit({ id: true, created_at: true });
export type InsertUserChannelIdentity = z.infer<typeof insertUserChannelIdentitySchema>;
export type UserChannelIdentity = typeof userChannelIdentity.$inferSelect;


// ============================================================
// NEW TABLE: user_channel_preferences
// ============================================================

export const userChannelPreferences = pgTable("user_channel_preferences", {
  id:         uuid("id").primaryKey().defaultRandom(),
  user_id:    text("user_id").notNull().unique(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  preferred_checkin_channel:      channelTypeEnum("preferred_checkin_channel").default("voice_outbound"),
  preferred_conversation_channel: channelTypeEnum("preferred_conversation_channel").default("voice_app"),
  preferred_reminder_channel:     channelTypeEnum("preferred_reminder_channel").default("whatsapp_outbound"),
  preferred_alert_channel:        channelTypeEnum("preferred_alert_channel").default("whatsapp_outbound"),

  voice_available_from:     text("voice_available_from").default("08:00"),
  voice_available_until:    text("voice_available_until").default("21:00"),
  whatsapp_available_from:  text("whatsapp_available_from").default("07:00"),
  whatsapp_available_until: text("whatsapp_available_until").default("22:00"),

  fallback_chain:                text("fallback_chain").array().default(["whatsapp_outbound", "voice_outbound"]),
  max_outbound_calls_per_day:    integer("max_outbound_calls_per_day").default(1),
  max_whatsapp_messages_per_day: integer("max_whatsapp_messages_per_day").default(5),
});

export const insertUserChannelPreferencesSchema = createInsertSchema(userChannelPreferences).omit({ id: true, updated_at: true });
export type InsertUserChannelPreferences = z.infer<typeof insertUserChannelPreferencesSchema>;
export type UserChannelPreferences = typeof userChannelPreferences.$inferSelect;


// ============================================================
// NEW TABLE: inbound_number_routing
// ============================================================

export const inboundNumberRouting = pgTable("inbound_number_routing", {
  id:           uuid("id").primaryKey().defaultRandom(),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  number:               text("number").notNull().unique(),
  number_label:         text("number_label"),
  channel:              channelTypeEnum("channel").notNull(),
  deployment_id:        text("deployment_id").notNull(),
  language:             text("language").notNull(),
  elevenlabs_agent_id:  text("elevenlabs_agent_id"),
  unregistered_flow:    text("unregistered_flow").notNull().default("onboard"),
  warm_hold_message:    text("warm_hold_message"),
  onboarding_link:      text("onboarding_link"),
  is_active:            boolean("is_active").notNull().default(true),
});

export const insertInboundNumberRoutingSchema = createInsertSchema(inboundNumberRouting).omit({ id: true, created_at: true });
export type InsertInboundNumberRouting = z.infer<typeof insertInboundNumberRoutingSchema>;
export type InboundNumberRouting = typeof inboundNumberRouting.$inferSelect;


// ============================================================
// NEW TABLE: subscription_plans
// ============================================================

export const subscriptionPlans = pgTable("subscription_plans", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  plan_id:             text("plan_id").notNull().unique(),
  name:                text("name").notNull(),
  description:         text("description"),
  price_eur:           integer("price_eur").notNull().default(0),
  price_gbp:           integer("price_gbp").notNull().default(0),
  billing_interval:    text("billing_interval").default("month"),
  trial_days:          integer("trial_days").default(14),
  stripe_price_id_eur: text("stripe_price_id_eur"),
  stripe_price_id_gbp: text("stripe_price_id_gbp"),
  features:            text("features").array(),
  is_active:           boolean("is_active").notNull().default(true),
  is_public:           boolean("is_public").notNull().default(true),
  sort_order:          integer("sort_order").default(0),
});
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, created_at: true, updated_at: true });
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;


// ============================================================
// NEW TABLE: billing_events
// ============================================================

export const billingEvents = pgTable("billing_events", {
  id:                uuid("id").primaryKey().defaultRandom(),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  user_id:           text("user_id").notNull(),
  stripe_event_id:   text("stripe_event_id").unique(),
  stripe_invoice_id: text("stripe_invoice_id"),
  stripe_charge_id:  text("stripe_charge_id"),
  event_type:        text("event_type").notNull(),
  amount_cents:      integer("amount_cents"),
  currency:          text("currency"),
  plan_id:           text("plan_id"),
  status:            text("status").notNull(),
  failure_reason:    text("failure_reason"),
  stripe_payload:    jsonb("stripe_payload").default({}),
});
export const insertBillingEventSchema = createInsertSchema(billingEvents).omit({ id: true, created_at: true });
export type InsertBillingEvent = z.infer<typeof insertBillingEventSchema>;
export type BillingEvent = typeof billingEvents.$inferSelect;


// ============================================================
// NEW TABLE: stripe_webhooks
// ============================================================

export const stripeWebhooks = pgTable("stripe_webhooks", {
  id:              uuid("id").primaryKey().defaultRandom(),
  received_at:     timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processed_at:    timestamp("processed_at", { withTimezone: true }),
  stripe_event_id: text("stripe_event_id").notNull().unique(),
  event_type:      text("event_type").notNull(),
  status:          text("status").notNull().default("pending"),
  error:           text("error"),
  payload:         jsonb("payload").notNull().default({}),
});
export const insertStripeWebhookSchema = createInsertSchema(stripeWebhooks).omit({ id: true, received_at: true });
export type InsertStripeWebhook = z.infer<typeof insertStripeWebhookSchema>;
export type StripeWebhook = typeof stripeWebhooks.$inferSelect;


// ============================================================
// NEW TABLE: scam_checks — AI scam document/photo analysis
// ============================================================

export const scamChecks = pgTable("scam_checks", {
  id:           uuid("id").primaryKey().defaultRandom(),
  user_id:      text("user_id").notNull(),
  file_type:    text("file_type").notNull().default("image"),
  risk_level:   text("risk_level").notNull(),
  result_title: text("result_title").notNull(),
  explanation:  text("explanation").notNull(),
  steps:        text("steps").array().notNull().default([]),
  image_data:   text("image_data"),
  checked_at:   timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScamCheckSchema = createInsertSchema(scamChecks).omit({ id: true, checked_at: true });
export type InsertScamCheck = z.infer<typeof insertScamCheckSchema>;
export type ScamCheck = typeof scamChecks.$inferSelect;


// ============================================================
// NEW TABLE: home_scans — AI safety hazard analysis of rooms
// ============================================================

export const homeScans = pgTable("home_scans", {
  id:           uuid("id").primaryKey().defaultRandom(),
  user_id:      text("user_id").notNull(),
  risk_level:   text("risk_level").notNull(),
  result_title: text("result_title").notNull(),
  hazards:      text("hazards").array().notNull().default([]),
  advice:       text("advice").notNull(),
  image_data:   text("image_data"),
  scanned_at:   timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHomeScanSchema = createInsertSchema(homeScans).omit({ id: true, scanned_at: true });
export type InsertHomeScan = z.infer<typeof insertHomeScanSchema>;
export type HomeScan = typeof homeScans.$inferSelect;


// ============================================================
// NEW TABLE: wound_scans
// ============================================================

export const woundScans = pgTable("wound_scans", {
  id:         uuid("id").primaryKey().defaultRandom(),
  user_id:    text("user_id").notNull(),
  severity:   text("severity").notNull(),
  result_title: text("result_title").notNull(),
  advice:     text("advice").notNull(),
  image_data: text("image_data"),
  scanned_at: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWoundScanSchema = createInsertSchema(woundScans).omit({ id: true, scanned_at: true });
export type InsertWoundScan = z.infer<typeof insertWoundScanSchema>;
export type WoundScan = typeof woundScans.$inferSelect;


// companion_profiles — selectable interests, hobbies, values, preferred activities for matching
export const companionProfiles = pgTable("companion_profiles", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  user_id:             text("user_id").notNull().unique().references(() => profiles.id, { onDelete: "cascade" }),
  interests:           text("interests").array().notNull().default([]),
  hobbies:             text("hobbies").array().notNull().default([]),
  values:              text("values").array().notNull().default([]),
  preferred_activities: text("preferred_activities").array().notNull().default([]),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompanionProfileSchema = createInsertSchema(companionProfiles).omit({ id: true, created_at: true, updated_at: true });
export type InsertCompanionProfile = z.infer<typeof insertCompanionProfileSchema>;
export type CompanionProfile = typeof companionProfiles.$inferSelect;


// ============================================================
// NEW TABLE: companion_connections — connection requests
// ============================================================

export const companionConnections = pgTable("companion_connections", {
  id:                uuid("id").primaryKey().defaultRandom(),
  requester_id:      text("requester_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  recipient_id:      text("recipient_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  status:            text("status").notNull().default("pending"),
  suggested_activity: text("suggested_activity").notNull().default(""),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompanionConnectionSchema = createInsertSchema(companionConnections).omit({ id: true, created_at: true, updated_at: true });
export type InsertCompanionConnection = z.infer<typeof insertCompanionConnectionSchema>;
export type CompanionConnection = typeof companionConnections.$inferSelect;


// ============================================================
// NEW TABLES: social_rooms, sessions, visits, interests, connections
// ============================================================

export const socialRooms = pgTable("social_rooms", {
  id:              uuid("id").primaryKey().defaultRandom(),
  slug:            text("slug").notNull().unique(),
  name_es:         text("name_es").notNull(),
  name_de:         text("name_de").notNull(),
  name_en:         text("name_en").notNull(),
  category:        text("category").notNull(),
  agent_slug:      text("agent_slug").notNull(),
  agent_full_name: text("agent_full_name").notNull(),
  agent_colour:    text("agent_colour").notNull(),
  agent_cred_es:   text("agent_cred_es").notNull(),
  agent_cred_de:   text("agent_cred_de").notNull(),
  agent_cred_en:   text("agent_cred_en").notNull(),
  cta_label_es:    text("cta_label_es").notNull(),
  cta_label_de:    text("cta_label_de").notNull(),
  cta_label_en:    text("cta_label_en").notNull(),
  topic_tags:      text("topic_tags").array().notNull().default([]),
  time_slots:      text("time_slots").array().notNull().default([]),
  is_active:       boolean("is_active").notNull().default(true),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialRoomSchema = createInsertSchema(socialRooms).omit({ id: true, created_at: true });
export type InsertSocialRoom = z.infer<typeof insertSocialRoomSchema>;
export type SocialRoom = typeof socialRooms.$inferSelect;

export const socialRoomSessions = pgTable("social_room_sessions", {
  id:                uuid("id").primaryKey().defaultRandom(),
  room_id:           uuid("room_id").notNull().references(() => socialRooms.id, { onDelete: "cascade" }),
  session_date:      text("session_date").notNull(),
  topic_es:          text("topic_es").notNull(),
  topic_de:          text("topic_de").notNull(),
  topic_en:          text("topic_en").notNull(),
  opener_es:         text("opener_es").notNull(),
  opener_de:         text("opener_de").notNull(),
  opener_en:         text("opener_en").notNull(),
  activity_type:     text("activity_type").notNull(),
  participant_count: integer("participant_count").notNull().default(0),
  is_live:           boolean("is_live").notNull().default(true),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("social_room_sessions_room_date_unique").on(t.room_id, t.session_date),
]);

export const insertSocialRoomSessionSchema = createInsertSchema(socialRoomSessions).omit({ id: true, created_at: true });
export type InsertSocialRoomSession = z.infer<typeof insertSocialRoomSessionSchema>;
export type SocialRoomSession = typeof socialRoomSessions.$inferSelect;

export const socialRoomVisits = pgTable("social_room_visits", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  room_id:          uuid("room_id").notNull().references(() => socialRooms.id, { onDelete: "cascade" }),
  session_id:       uuid("session_id").notNull().references(() => socialRoomSessions.id, { onDelete: "cascade" }),
  entered_at:       timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  last_active_at:   timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  messages_sent:    integer("messages_sent").notNull().default(0),
  duration_seconds: integer("duration_seconds"),
  completed:        boolean("completed").notNull().default(false),
});

export const insertSocialRoomVisitSchema = createInsertSchema(socialRoomVisits).omit({ id: true, entered_at: true, last_active_at: true });
export type InsertSocialRoomVisit = z.infer<typeof insertSocialRoomVisitSchema>;
export type SocialRoomVisit = typeof socialRoomVisits.$inferSelect;

export const socialUserInterests = pgTable("social_user_interests", {
  user_id:          text("user_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  interest_tags:    text("interest_tags").array().notNull().default([]),
  preferred_times:  text("preferred_times").array().notNull().default([]),
  activity_level:   text("activity_level").notNull().default("moderate"),
  room_visit_counts: jsonb("room_visit_counts").notNull().default({}),
  last_rooms:       text("last_rooms").array().notNull().default([]),
  updated_at:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialUserInterestsSchema = createInsertSchema(socialUserInterests).omit({ updated_at: true });
export type InsertSocialUserInterests = z.infer<typeof insertSocialUserInterestsSchema>;
export type SocialUserInterests = typeof socialUserInterests.$inferSelect;

export const socialConnections = pgTable("social_connections", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id_a:        text("user_id_a").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  user_id_b:        text("user_id_b").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  matched_via_room: text("matched_via_room").notNull(),
  matched_at:       timestamp("matched_at", { withTimezone: true }).notNull().defaultNow(),
  status:           text("status").notNull().default("pending"),
}, (t) => [
  unique("social_connections_pair_unique").on(t.user_id_a, t.user_id_b),
]);

export const insertSocialConnectionSchema = createInsertSchema(socialConnections).omit({ id: true, matched_at: true });
export type InsertSocialConnection = z.infer<typeof insertSocialConnectionSchema>;
export type SocialConnection = typeof socialConnections.$inferSelect;


// ============================================================
// NEW TABLE: triage_reports — persisted completed TriageSummary + vitals
// ============================================================

export const triageReports = pgTable("triage_reports", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id").notNull(),
  chief_complaint:  text("chief_complaint").notNull(),
  symptoms:         text("symptoms").array().notNull().default([]),
  urgency:          text("urgency").notNull(),
  recommendations:  text("recommendations").array().notNull().default([]),
  disclaimer:       text("disclaimer").notNull().default(""),
  ai_summary:        text("ai_summary"),
  bpm:               integer("bpm"),
  respiratory_rate:  integer("respiratory_rate"),
  duration_seconds:  integer("duration_seconds"),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTriageReportSchema = createInsertSchema(triageReports).omit({ id: true, created_at: true });
export type InsertTriageReport = z.infer<typeof insertTriageReportSchema>;
export type TriageReport = typeof triageReports.$inferSelect;


// ============================================================
// NEW TABLE: vitals_readings — persisted heart rate readings per user
// ============================================================

export const vitalsReadings = pgTable("vitals_readings", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id").notNull(),
  bpm:              integer("bpm"),
  respiratory_rate: integer("respiratory_rate"),
  metric_type:      text("metric_type"),
  value:            text("value"),
  recorded_at:      timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVitalsReadingSchema = createInsertSchema(vitalsReadings).omit({ id: true, recorded_at: true });
export type InsertVitalsReading = z.infer<typeof insertVitalsReadingSchema>;
export type VitalsReading = typeof vitalsReadings.$inferSelect;


// ============================================================
// NEW TABLE: utility_review_runs — evidence log for bill reviews
// ============================================================

// ============================================================
// NEW TABLE: organizations - invite and entitlement grouping
// ============================================================

export const organizations = pgTable("organizations", {
  id:            uuid("id").primaryKey().defaultRandom(),
  name:          text("name").notNull(),
  slug:          text("slug").notNull().unique(),
  contact_name:  text("contact_name"),
  contact_email: text("contact_email"),
  contact_phone: text("contact_phone"),
  default_tier:  text("default_tier").notNull().default("trial"),
  is_active:     boolean("is_active").notNull().default(true),
  metadata:      jsonb("metadata").notNull().default({}),
  created_at:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, created_at: true, updated_at: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export const tierEntitlements = pgTable("tier_entitlements", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  tier:                text("tier").notNull().unique(),
  display_name:        text("display_name").notNull(),
  description:         text("description"),
  voice_assistant:     boolean("voice_assistant").notNull().default(false),
  medication_tracking: boolean("medication_tracking").notNull().default(false),
  symptom_check:       boolean("symptom_check").notNull().default(false),
  concierge:           boolean("concierge").notNull().default(false),
  caregiver_dashboard: boolean("caregiver_dashboard").notNull().default(false),
  custom_features:     jsonb("custom_features").notNull().default({}),
  is_active:           boolean("is_active").notNull().default(true),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTierEntitlementSchema = createInsertSchema(tierEntitlements).omit({ id: true, created_at: true, updated_at: true });
export type InsertTierEntitlement = z.infer<typeof insertTierEntitlementSchema>;
export type TierEntitlement = typeof tierEntitlements.$inferSelect;

export const userIntakes = pgTable("user_intakes", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id"),
  elder_user_id:    text("elder_user_id"),
  family_user_id:   text("family_user_id"),
  name:             text("name").notNull(),
  phone:            text("phone").notNull(),
  email:            text("email"),
  user_type:        lifecycleUserTypeEnum("user_type").notNull().default("elder"),
  entry_point:      lifecycleEntryPointEnum("entry_point").notNull().default("form"),
  organization_id:  uuid("organization_id"),
  tier:             text("tier").notNull().default("trial"),
  status:           lifecycleStatusEnum("status").notNull().default("created"),
  journey_step:     text("journey_step").notNull().default("created"),
  consent_status:   text("consent_status").notNull().default("not_required"),
  source_payload:   jsonb("source_payload").notNull().default({}),
  metadata:         jsonb("metadata").notNull().default({}),
  link_sent_at:     timestamp("link_sent_at", { withTimezone: true }),
  activated_at:     timestamp("activated_at", { withTimezone: true }),
  dropped_at:       timestamp("dropped_at", { withTimezone: true }),
  last_activity_at: timestamp("last_activity_at", { withTimezone: true }),
  created_at:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserIntakeSchema = createInsertSchema(userIntakes).omit({ id: true, created_at: true, updated_at: true });
export type InsertUserIntake = z.infer<typeof insertUserIntakeSchema>;
export type UserIntake = typeof userIntakes.$inferSelect;

export const accessLinks = pgTable("access_links", {
  id:              uuid("id").primaryKey().defaultRandom(),
  token:           text("token").notNull().unique(),
  user_id:         text("user_id"),
  intake_id:       uuid("intake_id"),
  organization_id: uuid("organization_id"),
  link_type:       accessLinkTypeEnum("link_type").notNull().default("trial"),
  tier:            text("tier").notNull().default("trial"),
  destination:     text("destination").notNull().default("/onboarding"),
  target_role:     text("target_role").notNull().default("elder"),
  max_uses:        integer("max_uses").notNull().default(1),
  use_count:       integer("use_count").notNull().default(0),
  clicked_at:      timestamp("clicked_at", { withTimezone: true }),
  converted_at:    timestamp("converted_at", { withTimezone: true }),
  expires_at:      timestamp("expires_at", { withTimezone: true }).notNull(),
  revoked_at:      timestamp("revoked_at", { withTimezone: true }),
  metadata:        jsonb("metadata").notNull().default({}),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccessLinkSchema = createInsertSchema(accessLinks).omit({ id: true, created_at: true });
export type InsertAccessLink = z.infer<typeof insertAccessLinkSchema>;
export type AccessLink = typeof accessLinks.$inferSelect;

export const lifecycleEvents = pgTable("lifecycle_events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  intake_id:   uuid("intake_id"),
  user_id:     text("user_id"),
  event_type:  text("event_type").notNull(),
  from_status: text("from_status"),
  to_status:   text("to_status"),
  channel:     text("channel"),
  metadata:    jsonb("metadata").notNull().default({}),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLifecycleEventSchema = createInsertSchema(lifecycleEvents).omit({ id: true, created_at: true });
export type InsertLifecycleEvent = z.infer<typeof insertLifecycleEventSchema>;
export type LifecycleEvent = typeof lifecycleEvents.$inferSelect;

export const consentAttempts = pgTable("consent_attempts", {
  id:                uuid("id").primaryKey().defaultRandom(),
  intake_id:         uuid("intake_id"),
  elder_user_id:     text("elder_user_id"),
  family_user_id:    text("family_user_id"),
  attempt_number:    integer("attempt_number").notNull().default(1),
  status:            consentAttemptStatusEnum("status").notNull().default("pending"),
  channel:           text("channel").notNull().default("voice"),
  scheduled_at:      timestamp("scheduled_at", { withTimezone: true }),
  completed_at:      timestamp("completed_at", { withTimezone: true }),
  source_session_id: text("source_session_id"),
  result_payload:    jsonb("result_payload").notNull().default({}),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConsentAttemptSchema = createInsertSchema(consentAttempts).omit({ id: true, created_at: true });
export type InsertConsentAttempt = z.infer<typeof insertConsentAttemptSchema>;
export type ConsentAttempt = typeof consentAttempts.$inferSelect;

export const communicationsLog = pgTable("communications_log", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  intake_id:           uuid("intake_id"),
  user_id:             text("user_id"),
  channel:             text("channel").notNull(),
  recipient:           text("recipient").notNull(),
  purpose:             text("purpose").notNull(),
  status:              text("status").notNull().default("queued"),
  provider_message_id: text("provider_message_id"),
  body:                text("body"),
  metadata:            jsonb("metadata").notNull().default({}),
  sent_at:             timestamp("sent_at", { withTimezone: true }),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommunicationLogSchema = createInsertSchema(communicationsLog).omit({ id: true, created_at: true });
export type InsertCommunicationLog = z.infer<typeof insertCommunicationLogSchema>;
export type CommunicationLog = typeof communicationsLog.$inferSelect;

export const scheduledEvents = pgTable("scheduled_events", {
  id:                uuid("id").primaryKey().defaultRandom(),
  user_id:           text("user_id").notNull(),
  event_type:        text("event_type").notNull(),
  title:             text("title").notNull(),
  description:       text("description"),
  channel:           text("channel").notNull().default("app"),
  agent_id:          text("agent_id"),
  agent_slug:        text("agent_slug"),
  room_slug:         text("room_slug"),
  scheduled_for:     timestamp("scheduled_for", { withTimezone: true }).notNull(),
  timezone:          text("timezone").notNull().default("Europe/Madrid"),
  recurrence:        text("recurrence").notNull().default("none"),
  status:            text("status").notNull().default("upcoming"),
  source:            text("source").notNull().default("app"),
  source_session_id: text("source_session_id"),
  metadata:          jsonb("metadata").notNull().default({}),
  created_by:        text("created_by"),
  updated_by:        text("updated_by"),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScheduledEventSchema = createInsertSchema(scheduledEvents).omit({ id: true, created_at: true, updated_at: true });
export type InsertScheduledEvent = z.infer<typeof insertScheduledEventSchema>;
export type ScheduledEvent = typeof scheduledEvents.$inferSelect;

export const scheduledEventLogs = pgTable("scheduled_event_logs", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  scheduled_event_id: uuid("scheduled_event_id"),
  user_id:            text("user_id").notNull(),
  action:             text("action").notNull(),
  status:             text("status"),
  metadata:           jsonb("metadata").notNull().default({}),
  created_by:         text("created_by"),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScheduledEventLogSchema = createInsertSchema(scheduledEventLogs).omit({ id: true, created_at: true });
export type InsertScheduledEventLog = z.infer<typeof insertScheduledEventLogSchema>;
export type ScheduledEventLog = typeof scheduledEventLogs.$inferSelect;

export const utilityReviewRuns = pgTable("utility_review_runs", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  user_id:               text("user_id").notNull(),
  country:               text("country").notNull().default("ES"),
  utility_type:          text("utility_type").notNull(),
  input_method:          text("input_method").notNull(),
  extracted_data_json:   jsonb("extracted_data_json").notNull().default({}),
  normalized_input_json: jsonb("normalized_input_json").notNull().default({}),
  source_used:           text("source_used").notNull().default("CNMC"),
  source_status:         text("source_status").notNull().default("pending"),
  results_json:          jsonb("results_json").notNull().default([]),
  confidence:            text("confidence").notNull().default("medium"),
  created_at:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUtilityReviewRunSchema = createInsertSchema(utilityReviewRuns).omit({ id: true, created_at: true });
export type InsertUtilityReviewRun = z.infer<typeof insertUtilityReviewRunSchema>;
export type UtilityReviewRun = typeof utilityReviewRuns.$inferSelect;

export const homePlanCards = pgTable("home_plan_cards", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  card_id:                  text("card_id").notNull().unique(),
  is_enabled:               boolean("is_enabled").notNull().default(true),
  emoji:                    text("emoji").notNull().default("*"),
  bg:                       text("bg").notNull().default("#F4F0FF"),
  badge_bg:                 text("badge_bg").notNull().default("#EDE9FE"),
  badge_text:               text("badge_text").notNull().default("#6D28D9"),
  route:                    text("route").notNull().default("/"),
  base_priority:            integer("base_priority").notNull().default(50),
  condition_keywords:       text("condition_keywords").array().notNull().default([]),
  hobby_keywords:           text("hobby_keywords").array().notNull().default([]),
  avoid_condition_keywords: text("avoid_condition_keywords").array().notNull().default([]),
  admin_notes:              text("admin_notes"),
  created_at:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:               timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHomePlanCardSchema = createInsertSchema(homePlanCards).omit({ id: true, created_at: true, updated_at: true });
export type InsertHomePlanCard = z.infer<typeof insertHomePlanCardSchema>;
export type HomePlanCardRow = typeof homePlanCards.$inferSelect;

export const heroMessages = pgTable("hero_messages", {
  id:             uuid("id").primaryKey().defaultRandom(),
  message_id:     text("message_id").notNull().unique(),
  surface:        text("surface").notNull(),
  reason:         text("reason").notNull().default("evergreen"),
  priority:       integer("priority").notNull().default(10),
  cooldown_hours: integer("cooldown_hours").notNull().default(8),
  periods:        text("periods").array().notNull().default([]),
  safety_levels:  text("safety_levels").array().notNull().default([]),
  event_types:    text("event_types").array().notNull().default([]),
  activity_types: text("activity_types").array().notNull().default([]),
  copy:           jsonb("copy").notNull().default({}),
  is_enabled:     boolean("is_enabled").notNull().default(true),
  admin_notes:    text("admin_notes"),
  created_at:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHeroMessageSchema = createInsertSchema(heroMessages).omit({ id: true, created_at: true, updated_at: true });
export type InsertHeroMessage = z.infer<typeof insertHeroMessageSchema>;
export type HeroMessageRow = typeof heroMessages.$inferSelect;


// ============================================================
// SCHEMA EXPORT
// ============================================================

export const schema = {
  users,
  profiles,
  sessionState,
  sessionExchanges,
  agentDifficulty,
  caregiverAlerts,
  medicationAdherence,
  userMedications,
  onboardingState,
  consentLog,
  teamInvitations,
  userChannelIdentity,
  userChannelPreferences,
  inboundNumberRouting,
  subscriptionPlans,
  billingEvents,
  stripeWebhooks,
  scamChecks,
  homeScans,
  woundScans,
  companionProfiles,
  companionConnections,
  socialRooms,
  socialRoomSessions,
  socialRoomVisits,
  socialUserInterests,
  socialConnections,
  triageReports,
  vitalsReadings,
  organizations,
  tierEntitlements,
  userIntakes,
  accessLinks,
  lifecycleEvents,
  consentAttempts,
  communicationsLog,
  scheduledEvents,
  scheduledEventLogs,
  utilityReviewRuns,
  homePlanCards,
  heroMessages,
};
