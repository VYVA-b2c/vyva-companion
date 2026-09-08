CREATE TABLE IF NOT EXISTS "marketing_social_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "external_account_id" text NOT NULL,
  "external_account_name" text NOT NULL DEFAULT '',
  "access_token_encrypted" text NOT NULL,
  "token_expires_at" timestamp with time zone,
  "status" text NOT NULL DEFAULT 'connected',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "connected_by" text,
  "connected_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "marketing_social_connections_provider_account_unique" UNIQUE ("provider", "external_account_id")
);

CREATE INDEX IF NOT EXISTS "marketing_social_connections_provider_idx"
  ON "marketing_social_connections" ("provider");

CREATE INDEX IF NOT EXISTS "marketing_social_connections_status_idx"
  ON "marketing_social_connections" ("status");
