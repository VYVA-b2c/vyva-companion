-- Drop the existing FK from companion_profiles.user_id → users.id
-- and replace it with a reference to profiles.id so the demo user
-- (which exists in profiles but not in users) can use companion features.
ALTER TABLE "companion_profiles"
  DROP CONSTRAINT IF EXISTS "companion_profiles_user_id_fkey";

ALTER TABLE "companion_profiles"
  ADD CONSTRAINT "companion_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

-- Do the same for companion_connections (requester and recipient)
ALTER TABLE "companion_connections"
  DROP CONSTRAINT IF EXISTS "companion_connections_requester_id_fkey",
  DROP CONSTRAINT IF EXISTS "companion_connections_recipient_id_fkey";

ALTER TABLE "companion_connections"
  ADD CONSTRAINT "companion_connections_requester_id_fkey"
  FOREIGN KEY ("requester_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

ALTER TABLE "companion_connections"
  ADD CONSTRAINT "companion_connections_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
