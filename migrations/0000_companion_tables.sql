-- Create companion_profiles table
CREATE TABLE IF NOT EXISTS "companion_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "interests" text[] NOT NULL DEFAULT '{}',
  "hobbies" text[] NOT NULL DEFAULT '{}',
  "values" text[] NOT NULL DEFAULT '{}',
  "preferred_activities" text[] NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

-- Create companion_connections table
CREATE TABLE IF NOT EXISTS "companion_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "requester_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "recipient_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'accepted', 'declined')),
  "suggested_activity" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "companion_profiles_user_id_idx" ON "companion_profiles" ("user_id");
CREATE INDEX IF NOT EXISTS "companion_connections_requester_idx" ON "companion_connections" ("requester_id");
CREATE INDEX IF NOT EXISTS "companion_connections_recipient_idx" ON "companion_connections" ("recipient_id");
-- Canonical pair uniqueness: prevents duplicate connections regardless of who initiated
CREATE UNIQUE INDEX IF NOT EXISTS "companion_connections_pair_unique"
  ON "companion_connections" (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id));
