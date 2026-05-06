CREATE TYPE "public"."channel_type" AS ENUM('voice_app', 'voice_inbound', 'voice_outbound', 'whatsapp_text', 'whatsapp_voice', 'whatsapp_outbound', 'web_form', 'admin_template');--> statement-breakpoint
CREATE TYPE "public"."consent_action" AS ENUM('granted', 'denied', 'revoked', 'updated');--> statement-breakpoint
CREATE TYPE "public"."consent_scope" AS ENUM('health_conditions', 'medications', 'allergies', 'gp_details', 'vital_signs', 'mood_and_journal', 'location', 'conversation_summary', 'caregiver_full_access', 'caregiver_health_alerts', 'caregiver_mood_alerts', 'caregiver_medication_alerts', 'caregiver_safety_alerts', 'family_wellbeing_summary', 'family_health_detail', 'doctor_health_reports', 'doctor_vital_summaries', 'fall_detection', 'emergency_location_share', 'whatsapp_notifications', 'daily_digest_to_caregiver');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."onboarding_channel" AS ENUM('voice', 'web_form', 'whatsapp', 'proxy_web', 'admin_template');--> statement-breakpoint
CREATE TYPE "public"."onboarding_stage" AS ENUM('stage_1_identity', 'stage_2_preferences', 'stage_3_health', 'stage_4_care_team', 'stage_5_consent', 'complete');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('caregiver', 'family_member', 'friend', 'doctor', 'gp');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"activity_type" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"calories" integer DEFAULT 0 NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_difficulty" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"difficulty_level" integer DEFAULT 1 NOT NULL,
	"sessions_at_level" integer DEFAULT 0 NOT NULL,
	"last_score" real,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"stripe_event_id" text,
	"stripe_invoice_id" text,
	"stripe_charge_id" text,
	"event_type" text NOT NULL,
	"amount_cents" integer,
	"currency" text,
	"plan_id" text,
	"status" text NOT NULL,
	"failure_reason" text,
	"stripe_payload" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "billing_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "caregiver_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"sent_to" text[],
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companion_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"suggested_activity" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companion_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"hobbies" text[] DEFAULT '{}' NOT NULL,
	"values" text[] DEFAULT '{}' NOT NULL,
	"preferred_activities" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companion_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "consent_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"scope" "consent_scope" NOT NULL,
	"action" "consent_action" NOT NULL,
	"target_user_id" text,
	"target_name" text,
	"target_role" "team_role",
	"channel" "onboarding_channel" NOT NULL,
	"confirmed_by_elder" boolean DEFAULT true NOT NULL,
	"confirmation_method" text
);
--> statement-breakpoint
CREATE TABLE "daily_step_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"log_date" text NOT NULL,
	"steps" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_step_logs_user_date_unique" UNIQUE("user_id","log_date")
);
--> statement-breakpoint
CREATE TABLE "home_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"risk_level" text NOT NULL,
	"result_title" text NOT NULL,
	"hazards" text[] DEFAULT '{}' NOT NULL,
	"advice" text NOT NULL,
	"image_data" text,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_number_routing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"number" text NOT NULL,
	"number_label" text,
	"channel" "channel_type" NOT NULL,
	"deployment_id" text NOT NULL,
	"language" text NOT NULL,
	"elevenlabs_agent_id" text,
	"unregistered_flow" text DEFAULT 'onboard' NOT NULL,
	"warm_hold_message" text,
	"onboarding_link" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "inbound_number_routing_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "medication_adherence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"medication_name" text NOT NULL,
	"scheduled_time" text NOT NULL,
	"status" text NOT NULL,
	"confirmed_by" text DEFAULT 'user' NOT NULL,
	"confirmed_taken_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"has_preferred_name" boolean DEFAULT false NOT NULL,
	"has_phone_number" boolean DEFAULT false NOT NULL,
	"has_language" boolean DEFAULT false NOT NULL,
	"has_date_of_birth" boolean DEFAULT false NOT NULL,
	"has_emergency_address" boolean DEFAULT false NOT NULL,
	"has_checkin_preference" boolean DEFAULT false NOT NULL,
	"has_location" boolean DEFAULT false NOT NULL,
	"has_health_conditions" boolean DEFAULT false NOT NULL,
	"has_medications" boolean DEFAULT false NOT NULL,
	"has_allergies" boolean DEFAULT false NOT NULL,
	"has_gp_details" boolean DEFAULT false NOT NULL,
	"has_caregiver" boolean DEFAULT false NOT NULL,
	"has_family_member" boolean DEFAULT false NOT NULL,
	"has_doctor" boolean DEFAULT false NOT NULL,
	"feature_companionship" boolean DEFAULT true NOT NULL,
	"feature_brain_training" boolean DEFAULT true NOT NULL,
	"feature_daily_checkin" boolean DEFAULT true NOT NULL,
	"feature_medication_mgmt" boolean DEFAULT false NOT NULL,
	"feature_vital_scan" boolean DEFAULT false NOT NULL,
	"feature_health_research" boolean DEFAULT false NOT NULL,
	"feature_nutrition_coach" boolean DEFAULT false NOT NULL,
	"feature_safety_agent" boolean DEFAULT false NOT NULL,
	"feature_fall_detection" boolean DEFAULT false NOT NULL,
	"feature_concierge" boolean DEFAULT false NOT NULL,
	"feature_caregiver_alerts" boolean DEFAULT false NOT NULL,
	"nudge_dob_sent_at" timestamp with time zone,
	"nudge_address_sent_at" timestamp with time zone,
	"nudge_medications_sent_at" timestamp with time zone,
	"nudge_health_sent_at" timestamp with time zone,
	"nudge_caregiver_sent_at" timestamp with time zone,
	"stage_1_channel" "onboarding_channel",
	"stage_2_channel" "onboarding_channel",
	"stage_3_channel" "onboarding_channel",
	"stage_4_channel" "onboarding_channel",
	"stage_5_channel" "onboarding_channel",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_state_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text,
	"date_of_birth" text,
	"language" text DEFAULT 'en' NOT NULL,
	"deployment" text DEFAULT 'standard' NOT NULL,
	"mem0_user_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text DEFAULT 'trial' NOT NULL,
	"subscription_tier" text DEFAULT 'free' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"preferred_name" text,
	"avatar_url" text,
	"phone_number" text,
	"email" text,
	"whatsapp_number" text,
	"contact_method" text,
	"channel_reports" text DEFAULT 'email',
	"channel_chats" text DEFAULT 'in-app',
	"channel_notifications" text DEFAULT 'whatsapp',
	"hybrid_channel_mode" boolean DEFAULT false,
	"facebook_url" text,
	"instagram_url" text,
	"country_code" text DEFAULT 'ES',
	"timezone" text DEFAULT 'Europe/Madrid',
	"current_stage" "onboarding_stage" DEFAULT 'stage_1_identity',
	"onboarding_channel" "onboarding_channel",
	"proxy_initiator_id" text,
	"proxy_initiated_at" timestamp with time zone,
	"elder_confirm_token" text,
	"elder_confirmed_at" timestamp with time zone,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"stage_1_completed_at" timestamp with time zone,
	"stage_2_completed_at" timestamp with time zone,
	"stage_3_completed_at" timestamp with time zone,
	"stage_4_completed_at" timestamp with time zone,
	"stage_5_completed_at" timestamp with time zone,
	"address_line_1" text,
	"city" text,
	"region" text,
	"postcode" text,
	"caregiver_name" text,
	"caregiver_contact" text,
	"gp_name" text,
	"gp_phone" text,
	"gp_address" text,
	"gp_maps_url" text,
	"gp_place_id" text,
	"known_allergies" text[],
	"social_enabled" boolean DEFAULT false,
	"discoverable" boolean DEFAULT false,
	"match_opt_in" boolean DEFAULT false,
	"group_opt_in" boolean DEFAULT false,
	"data_sharing_consent" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_elder_confirm_token_unique" UNIQUE("elder_confirm_token")
);
--> statement-breakpoint
CREATE TABLE "scam_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"file_type" text DEFAULT 'image' NOT NULL,
	"risk_level" text NOT NULL,
	"result_title" text NOT NULL,
	"explanation" text NOT NULL,
	"steps" text[] DEFAULT '{}' NOT NULL,
	"image_data" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_exchanges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"speaker" text NOT NULL,
	"message" text NOT NULL,
	"agent_used" text,
	"intent_classified" text,
	"intent_confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"current_agent" text DEFAULT 'companion' NOT NULL,
	"last_agent" text,
	"last_intent" text,
	"last_activity_at" timestamp with time zone,
	"turn_count" integer DEFAULT 0 NOT NULL,
	"next_agent_override" text,
	"channel" "channel_type" DEFAULT 'voice_app',
	"previous_channel" "channel_type",
	"channel_switched" boolean DEFAULT false,
	"context_snapshot" jsonb DEFAULT '{}'::jsonb,
	"resolved_by" text,
	"was_unregistered" boolean DEFAULT false,
	"onboarding_triggered" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_state_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "social_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id_a" text NOT NULL,
	"user_id_b" text NOT NULL,
	"matched_via_room" text NOT NULL,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "social_connections_pair_unique" UNIQUE("user_id_a","user_id_b")
);
--> statement-breakpoint
CREATE TABLE "social_room_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"session_date" text NOT NULL,
	"topic_es" text NOT NULL,
	"topic_de" text NOT NULL,
	"topic_en" text NOT NULL,
	"opener_es" text NOT NULL,
	"opener_de" text NOT NULL,
	"opener_en" text NOT NULL,
	"activity_type" text NOT NULL,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"is_live" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_room_sessions_room_date_unique" UNIQUE("room_id","session_date")
);
--> statement-breakpoint
CREATE TABLE "social_room_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"room_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_es" text NOT NULL,
	"name_de" text NOT NULL,
	"name_en" text NOT NULL,
	"category" text NOT NULL,
	"agent_slug" text NOT NULL,
	"agent_full_name" text NOT NULL,
	"agent_colour" text NOT NULL,
	"agent_cred_es" text NOT NULL,
	"agent_cred_de" text NOT NULL,
	"agent_cred_en" text NOT NULL,
	"cta_label_es" text NOT NULL,
	"cta_label_de" text NOT NULL,
	"cta_label_en" text NOT NULL,
	"topic_tags" text[] DEFAULT '{}' NOT NULL,
	"time_slots" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_rooms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "social_user_interests" (
	"user_id" text PRIMARY KEY NOT NULL,
	"interest_tags" text[] DEFAULT '{}' NOT NULL,
	"preferred_times" text[] DEFAULT '{}' NOT NULL,
	"activity_level" text DEFAULT 'moderate' NOT NULL,
	"room_visit_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_rooms" text[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "stripe_webhooks_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plan_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_eur" integer DEFAULT 0 NOT NULL,
	"price_gbp" integer DEFAULT 0 NOT NULL,
	"billing_interval" text DEFAULT 'month',
	"trial_days" integer DEFAULT 14,
	"stripe_price_id_eur" text,
	"stripe_price_id_gbp" text,
	"features" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	CONSTRAINT "subscription_plans_plan_id_unique" UNIQUE("plan_id")
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"senior_id" text NOT NULL,
	"invitee_name" text NOT NULL,
	"invitee_phone" text,
	"invitee_email" text,
	"invitee_whatsapp" text,
	"role" "team_role" NOT NULL,
	"relationship" text,
	"invite_token" text NOT NULL,
	"invite_channel" "channel_type" DEFAULT 'whatsapp_outbound' NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_user_id" text,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"can_receive_daily_digest" boolean DEFAULT true NOT NULL,
	"can_receive_safety_alerts" boolean DEFAULT true NOT NULL,
	"can_receive_health_alerts" boolean DEFAULT false NOT NULL,
	"can_receive_mood_alerts" boolean DEFAULT false NOT NULL,
	"can_receive_medication_alerts" boolean DEFAULT false NOT NULL,
	"can_view_dashboard" boolean DEFAULT false NOT NULL,
	"can_view_health_reports" boolean DEFAULT false NOT NULL,
	"can_view_vital_signs" boolean DEFAULT false NOT NULL,
	"can_view_journal_summaries" boolean DEFAULT false NOT NULL,
	CONSTRAINT "team_invitations_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "triage_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"chief_complaint" text NOT NULL,
	"symptoms" text[] DEFAULT '{}' NOT NULL,
	"urgency" text NOT NULL,
	"recommendations" text[] DEFAULT '{}' NOT NULL,
	"disclaimer" text DEFAULT '' NOT NULL,
	"ai_summary" text,
	"bpm" integer,
	"respiratory_rate" integer,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_channel_identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"channel" "channel_type" NOT NULL,
	"identifier" text NOT NULL,
	"label" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"verification_method" text,
	"is_proxy" boolean DEFAULT false NOT NULL,
	"proxy_owner_id" text
);
--> statement-breakpoint
CREATE TABLE "user_channel_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"preferred_checkin_channel" "channel_type" DEFAULT 'voice_outbound',
	"preferred_conversation_channel" "channel_type" DEFAULT 'voice_app',
	"preferred_reminder_channel" "channel_type" DEFAULT 'whatsapp_outbound',
	"preferred_alert_channel" "channel_type" DEFAULT 'whatsapp_outbound',
	"voice_available_from" text DEFAULT '08:00',
	"voice_available_until" text DEFAULT '21:00',
	"whatsapp_available_from" text DEFAULT '07:00',
	"whatsapp_available_until" text DEFAULT '22:00',
	"fallback_chain" text[] DEFAULT '{"whatsapp_outbound","voice_outbound"}',
	"max_outbound_calls_per_day" integer DEFAULT 1,
	"max_whatsapp_messages_per_day" integer DEFAULT 5,
	CONSTRAINT "user_channel_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"medication_name" text NOT NULL,
	"dosage" text,
	"frequency" text,
	"scheduled_times" text[],
	"active" boolean DEFAULT true NOT NULL,
	"added_by" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"reset_token" text,
	"reset_token_expires_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vitals_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bpm" integer,
	"respiratory_rate" integer,
	"metric_type" text,
	"value" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wound_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"severity" text NOT NULL,
	"result_title" text NOT NULL,
	"advice" text NOT NULL,
	"image_data" text,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companion_connections" ADD CONSTRAINT "companion_connections_requester_id_profiles_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_connections" ADD CONSTRAINT "companion_connections_recipient_id_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_profiles" ADD CONSTRAINT "companion_profiles_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_user_id_a_profiles_id_fk" FOREIGN KEY ("user_id_a") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_user_id_b_profiles_id_fk" FOREIGN KEY ("user_id_b") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_room_sessions" ADD CONSTRAINT "social_room_sessions_room_id_social_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."social_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_room_visits" ADD CONSTRAINT "social_room_visits_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_room_visits" ADD CONSTRAINT "social_room_visits_room_id_social_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."social_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_room_visits" ADD CONSTRAINT "social_room_visits_session_id_social_room_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."social_room_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_user_interests" ADD CONSTRAINT "social_user_interests_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;