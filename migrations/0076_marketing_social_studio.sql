CREATE TABLE IF NOT EXISTS "marketing_media_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "media_asset_id" uuid NOT NULL REFERENCES "marketing_media_assets"("id") ON DELETE CASCADE,
  "mime_type" text NOT NULL DEFAULT 'image/jpeg',
  "image_bytes" bytea NOT NULL,
  "width" integer,
  "height" integer,
  "prompt" text,
  "model" text,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "marketing_media_files_asset_unique" UNIQUE ("media_asset_id")
);
