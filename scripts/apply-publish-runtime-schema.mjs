import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set; publish runtime schema cannot be applied.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const migrationPaths = [
  "0076_marketing_social_studio.sql",
  "0077_marketing_social_connections.sql",
  "0081_health_semantic_memory_outbox.sql",
  "0083_replit_publish_runtime_schema.sql",
  "0084_replit_publish_schema_parity.sql",
].map((name) => path.join(repoRoot, "migrations", name));
const migrationSql = migrationPaths
  .map((migrationPath) => readFileSync(migrationPath, "utf8"))
  .join("\n\n");
const requiredTables = [
  "marketing_media_files",
  "marketing_social_connections",
  "health_semantic_memory_outbox",
  "home_fast_help_impressions",
  "home_fast_help_journeys",
  "home_fast_help_journey_events",
  "cross_pillar_execution_attempts",
];
const requiredColumns = [
  "user_providers.is_trusted",
  "user_channel_preferences.preventive_web_push_enabled",
  "user_channel_preferences.preventive_web_push_consent_revision",
  "user_channel_preferences.preventive_web_push_consent_updated_at",
  "user_channel_preferences.preventive_web_push_consent_granted_at",
  "user_channel_preferences.preventive_web_push_consent_revoked_at",
  "checkin_sessions.why_today",
  "checkin_sessions.trend_note",
  "checkin_sessions.personal_plan",
  "checkin_sessions.app_suggestion",
  "checkin_sessions.suggested_app_action",
  "checkin_sessions.orchestration_flow_id",
  "checkin_sessions.orchestration_flow_version",
  "checkin_sessions.orchestration_flow_instance_id",
  "checkin_sessions.orchestration_completion_reference",
  "checkin_sessions.orchestration_answer_digest",
  "checkin_sessions.orchestration_completion_status",
  "checkin_sessions.orchestration_claim_token",
  "checkin_sessions.orchestration_claimed_at",
  "checkin_sessions.orchestration_claim_expires_at",
  "checkin_sessions.orchestration_failure_reason",
];

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query("select pg_advisory_lock($1)", [83920083]);
  await client.query("begin");
  await client.query(migrationSql);
  await client.query("commit");

  const tablesVerification = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])`,
    [requiredTables],
  );
  const readyTables = new Set(tablesVerification.rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((name) => !readyTables.has(name));

  const columnsVerification = await client.query(
    `select table_name || '.' || column_name as name
       from information_schema.columns
      where table_schema = 'public'
        and table_name || '.' || column_name = any($1::text[])`,
    [requiredColumns],
  );
  const readyColumns = new Set(columnsVerification.rows.map((row) => row.name));
  const missingColumns = requiredColumns.filter((name) => !readyColumns.has(name));

  if (missingTables.length > 0 || missingColumns.length > 0) {
    throw new Error(
      `schema verification failed (missing tables: ${missingTables.join(", ") || "none"}; `
      + `missing columns: ${missingColumns.join(", ") || "none"})`,
    );
  }

  console.log("Publish runtime schema ready.");
} catch (error) {
  try {
    await client.query("rollback");
  } catch (_) {
    // Preserve the original migration or verification error.
  }
  console.error(
    `Publish runtime schema failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  try {
    await client.query("select pg_advisory_unlock($1)", [83920083]);
  } catch (_) {
    // Closing the connection releases the lock too.
  }
  await client.end();
}
