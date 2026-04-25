-- Safe additive migration for Replit environments that are missing
-- the Social Rooms schema. This file only creates missing objects.
-- It does not drop or alter existing non-social tables.

-- Needed for gen_random_uuid() in Postgres / Replit DB
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS social_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name_es         TEXT NOT NULL,
  name_de         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  category        TEXT NOT NULL
                  CHECK (category IN ('activity', 'social', 'useful', 'connection')),
  agent_slug      TEXT NOT NULL,
  agent_full_name TEXT NOT NULL,
  agent_colour    TEXT NOT NULL,
  agent_cred_es   TEXT NOT NULL,
  agent_cred_de   TEXT NOT NULL,
  agent_cred_en   TEXT NOT NULL,
  cta_label_es    TEXT NOT NULL,
  cta_label_de    TEXT NOT NULL,
  cta_label_en    TEXT NOT NULL,
  topic_tags      TEXT[] NOT NULL DEFAULT '{}',
  time_slots      TEXT[] NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_room_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           UUID NOT NULL REFERENCES social_rooms(id) ON DELETE CASCADE,
  session_date      TEXT NOT NULL,
  topic_es          TEXT NOT NULL,
  topic_de          TEXT NOT NULL,
  topic_en          TEXT NOT NULL,
  opener_es         TEXT NOT NULL,
  opener_de         TEXT NOT NULL,
  opener_en         TEXT NOT NULL,
  activity_type     TEXT NOT NULL
                    CHECK (activity_type IN ('discussion','quiz','challenge','recipe','game','story','advice')),
  participant_count INTEGER NOT NULL DEFAULT 0,
  is_live           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_room_sessions_room_date_unique UNIQUE (room_id, session_date)
);

CREATE TABLE IF NOT EXISTS social_room_visits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_id          UUID NOT NULL REFERENCES social_rooms(id) ON DELETE CASCADE,
  session_id       UUID NOT NULL REFERENCES social_room_sessions(id) ON DELETE CASCADE,
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  messages_sent    INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  completed        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS social_user_interests (
  user_id           TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  interest_tags     TEXT[] NOT NULL DEFAULT '{}',
  preferred_times   TEXT[] NOT NULL DEFAULT '{}',
  activity_level    TEXT NOT NULL DEFAULT 'moderate'
                    CHECK (activity_level IN ('low','moderate','active')),
  room_visit_counts JSONB NOT NULL DEFAULT '{}',
  last_rooms        TEXT[] NOT NULL DEFAULT '{}',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id_b        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  matched_via_room TEXT NOT NULL,
  matched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','active','paused')),
  CONSTRAINT social_connections_pair_unique UNIQUE (user_id_a, user_id_b)
);

CREATE INDEX IF NOT EXISTS idx_social_room_visits_user
  ON social_room_visits (user_id, entered_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_room_sessions_date
  ON social_room_sessions (room_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_social_rooms_category
  ON social_rooms (category, is_active);
