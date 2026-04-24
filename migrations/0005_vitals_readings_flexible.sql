-- Make bpm nullable so readings for other metric types (rr, bp) don't require it
ALTER TABLE "vitals_readings" ALTER COLUMN "bpm" DROP NOT NULL;

-- Add flexible metric_type + value columns for dashboard-logged readings
ALTER TABLE "vitals_readings" ADD COLUMN IF NOT EXISTS "metric_type" text;
ALTER TABLE "vitals_readings" ADD COLUMN IF NOT EXISTS "value" text;
