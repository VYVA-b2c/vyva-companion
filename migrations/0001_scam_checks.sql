-- Create scam_checks table for the No Scam Guard feature
CREATE TABLE IF NOT EXISTS "scam_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "file_type" text NOT NULL DEFAULT 'image',
  "risk_level" text NOT NULL,
  "result_title" text NOT NULL,
  "explanation" text NOT NULL,
  "steps" text[] NOT NULL DEFAULT '{}',
  "image_data" text,
  "checked_at" timestamptz NOT NULL DEFAULT now()
);

-- Index for fast user history lookup
CREATE INDEX IF NOT EXISTS "scam_checks_user_id_idx" ON "scam_checks" ("user_id");
CREATE INDEX IF NOT EXISTS "scam_checks_checked_at_idx" ON "scam_checks" ("checked_at" DESC);
