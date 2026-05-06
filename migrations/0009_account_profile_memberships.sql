DO $$ BEGIN
  CREATE TYPE profile_member_role AS ENUM ('elder', 'caregiver', 'family', 'doctor', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE profile_member_status AS ENUM ('active', 'pending_elder_consent', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_profile_id text,
  ADD COLUMN IF NOT EXISTS onboarding_intent text;

CREATE TABLE IF NOT EXISTS profile_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role profile_member_role NOT NULL,
  status profile_member_status NOT NULL DEFAULT 'active',
  relationship text,
  display_name text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_primary boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_memberships_user_profile_unique UNIQUE (user_id, profile_id)
);

CREATE INDEX IF NOT EXISTS profile_memberships_user_id_idx ON profile_memberships(user_id);
CREATE INDEX IF NOT EXISTS profile_memberships_profile_id_idx ON profile_memberships(profile_id);
CREATE INDEX IF NOT EXISTS profile_memberships_user_primary_idx ON profile_memberships(user_id, is_primary);

INSERT INTO profile_memberships (user_id, profile_id, role, status, relationship, is_primary, accepted_at)
SELECT u.id, p.id, 'elder', 'active', 'self', true, now()
FROM users u
JOIN profiles p ON p.id = u.id
ON CONFLICT (user_id, profile_id) DO NOTHING;

UPDATE users u
SET active_profile_id = u.id
WHERE active_profile_id IS NULL
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id);
