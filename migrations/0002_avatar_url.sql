-- Add avatar_url column to profiles for community photo display
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "avatar_url" text;
