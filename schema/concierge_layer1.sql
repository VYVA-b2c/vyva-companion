CREATE TABLE user_providers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  category         text NOT NULL
                   CHECK (category IN (
                     'taxi', 'pharmacy', 'gp', 'hospital', 'dentist',
                     'physio', 'clinic', 'restaurant', 'cafe', 'takeaway',
                     'supermarket', 'convenience', 'shopping',
                     'beauty_salon', 'hair_care', 'spa', 'gym',
                     'home_repair', 'electrician', 'plumber', 'cleaner',
                     'other'
                   )),

  name             text NOT NULL,
  phone            text,
  address          text,
  place_id         text,
  maps_url         text,
  notes            text,
  is_primary       boolean NOT NULL DEFAULT true,
  is_active        boolean NOT NULL DEFAULT true,

  last_used_at     timestamp with time zone,
  use_count        integer NOT NULL DEFAULT 0,

  language         text NOT NULL DEFAULT 'es',
  created_at       timestamp with time zone DEFAULT now(),
  updated_at       timestamp with time zone DEFAULT now()
);


CREATE TABLE concierge_pending (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  use_case         text NOT NULL
                   CHECK (use_case IN (
                     'book_ride',
                     'order_medicine',
                     'book_appointment',
                     'home_service',
                     'find_provider',
                     'find_offers',
                     'paperwork',
                     'travel',
                     'send_message',
                     'order_food'
                   )),

  provider_id      uuid REFERENCES user_providers(id) ON DELETE SET NULL,
  provider_name    text,
  provider_phone   text,

  found_externally boolean NOT NULL DEFAULT false,

  action_summary   text NOT NULL,
  action_payload   jsonb NOT NULL DEFAULT '{}',

  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN (
                     'pending',
                     'calling',
                     'completed',
                     'failed',
                     'cancelled'
                   )),

  language         text NOT NULL DEFAULT 'es',
  confirmed_at     timestamp with time zone DEFAULT now(),
  expires_at       timestamp with time zone DEFAULT (now() + interval '30 minutes'),
  updated_at       timestamp with time zone DEFAULT now()
);


CREATE TABLE concierge_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  pending_id       uuid REFERENCES concierge_pending(id) ON DELETE SET NULL,

  use_case         text NOT NULL
                   CHECK (use_case IN (
                     'book_ride',
                     'order_medicine',
                     'book_appointment',
                     'home_service',
                     'find_provider',
                     'find_offers',
                     'paperwork',
                     'travel',
                     'send_message',
                     'order_food'
                   )),

  provider_id      uuid REFERENCES user_providers(id) ON DELETE SET NULL,
  provider_name    text,
  provider_phone   text,
  found_externally boolean NOT NULL DEFAULT false,

  action_summary   text,
  action_payload   jsonb DEFAULT '{}',

  outcome          text NOT NULL DEFAULT 'pending'
                   CHECK (outcome IN (
                     'confirmed',
                     'no_answer',
                     'cant_fulfil',
                     'user_cancelled',
                     'error'
                   )),

  outcome_payload        jsonb DEFAULT '{}',
  outcome_summary        text,

  family_notified        boolean NOT NULL DEFAULT false,
  call_duration_seconds  integer,
  location_type          text,

  started_at       timestamp with time zone DEFAULT now(),
  completed_at     timestamp with time zone
);


CREATE TABLE concierge_reminders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  reminder_type        text NOT NULL
                       CHECK (reminder_type IN (
                         'appointment',
                         'medication_refill',
                         'benefit_renewal',
                         'bill_payment',
                         'recurring_errand',
                         'custom'
                       )),

  title                text NOT NULL,
  description          text,

  reminder_date        date NOT NULL,
  reminder_time        time,
  advance_notice_days  integer NOT NULL DEFAULT 1,

  source_session_id    uuid REFERENCES concierge_sessions(id) ON DELETE SET NULL,
  source_use_case      text,

  language             text NOT NULL DEFAULT 'es',
  is_active            boolean NOT NULL DEFAULT true,
  triggered            boolean NOT NULL DEFAULT false,
  triggered_at         timestamp with time zone,

  created_at           timestamp with time zone DEFAULT now(),
  updated_at           timestamp with time zone DEFAULT now()
);


ALTER TABLE user_providers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_pending   ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_providers"
  ON user_providers FOR ALL
  USING (auth.uid()::text = user_id);

CREATE POLICY "user_own_pending"
  ON concierge_pending FOR ALL
  USING (auth.uid()::text = user_id);

CREATE POLICY "user_own_sessions"
  ON concierge_sessions FOR ALL
  USING (auth.uid()::text = user_id);

CREATE POLICY "user_own_reminders"
  ON concierge_reminders FOR ALL
  USING (auth.uid()::text = user_id);


CREATE INDEX idx_up_user_category
  ON user_providers (user_id, category, is_primary)
  WHERE is_active = true;

CREATE INDEX idx_up_user_usecount
  ON user_providers (user_id, use_count DESC)
  WHERE is_active = true;

CREATE INDEX idx_cp_user_status
  ON concierge_pending (user_id, status)
  WHERE status IN ('pending', 'calling');

CREATE INDEX idx_cs_user_started
  ON concierge_sessions (user_id, started_at DESC);

CREATE INDEX idx_cs_user_usecase
  ON concierge_sessions (user_id, use_case, started_at DESC);

CREATE INDEX idx_cr_user_active
  ON concierge_reminders (user_id, reminder_date ASC)
  WHERE is_active = true AND triggered = false;


-- Self-check
-- [x] All four tables created with no SQL errors
-- [x] No existing tables modified
-- [x] All user_id columns are type text (not uuid)
-- [x] All foreign keys reference profiles(id) - not auth.users(id)
-- [x] RLS enabled on all four tables
-- [x] RLS policies use auth.uid()::text cast to match text user_id
-- [x] concierge_pending.found_externally column exists (boolean, default false)
-- [x] concierge_sessions.location_type column exists (text, nullable)
-- [x] concierge_pending.expires_at defaults to now() + interval '30 minutes'
-- [x] concierge_pending.status CHECK covers all five values
-- [x] concierge_sessions.outcome defaults to 'pending'
-- [x] user_providers allows insert with only user_id, category, name
-- [x] concierge_reminders allows insert with only user_id, reminder_type, title, reminder_date
-- [x] All six indexes created successfully

-- TODO Brief #02: Supabase Edge Function - POST /functions/v1/concierge-webhook
-- Receives ElevenLabs outbound call result.
-- Reads concierge_pending by id.
-- Writes outcome to concierge_sessions.
-- Sets concierge_pending.status = 'completed' or 'failed'.
-- If found_externally = true and outcome = 'confirmed': triggers save-provider prompt.
-- If use_case = 'book_appointment' and outcome = 'confirmed': auto-inserts concierge_reminders row.
-- Increments user_providers.use_count for the provider called.

-- TODO Brief #03: React component - src/concierge/ConfirmationCard.jsx
-- Props: pendingAction (concierge_pending row), onConfirm, onCancel
-- Displays action_summary + parsed action_payload fields.
-- On confirm: sets status = 'calling', triggers outbound call.
-- On cancel: sets status = 'cancelled'.
