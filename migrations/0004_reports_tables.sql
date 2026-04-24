CREATE TABLE IF NOT EXISTS "triage_reports" (
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
CREATE TABLE IF NOT EXISTS "vitals_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bpm" integer NOT NULL,
	"respiratory_rate" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "triage_reports_user_id_idx" ON "triage_reports" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vitals_readings_user_id_idx" ON "vitals_readings" ("user_id");
