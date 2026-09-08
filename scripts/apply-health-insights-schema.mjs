import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readMigration(fileName) {
  return readFileSync(path.join(repoRoot, "migrations", fileName), "utf8");
}

function extractActionSeedInserts(sql) {
  const matches = sql.match(/INSERT INTO agewell_action_library[\s\S]*?;\s*(?=\r?\n\r?\n--|$)/g);
  return matches ?? [];
}

const coreSql = readMigration("0057_health_insights_engine_core.sql");
const actionSeedSql = readMigration("0058_agewell_action_library_seed.sql");
const outcomesSql = readMigration("0059_health_insight_outcomes.sql");
const backendCleanupSql = readMigration("0060_health_insights_backend_owned_cleanup.sql");
const longevityPlanSql = readMigration("0086_longevity_prevention_plans.sql");
const longevityIdentitySql = readMigration("0087_longevity_prevention_identity.sql");
const longevityDailyContentSql = readMigration("0089_prevention_daily_content.sql");
const longevityCompanionSql = readMigration("0093_longevity_companion_events.sql");
const longevityContentUpgradeSql = readMigration("0096_longevity_content_upgrade.sql");
const actionSeedInserts = extractActionSeedInserts(actionSeedSql);

const agewellActionTableSql = `
create extension if not exists pgcrypto;

create table if not exists public.agewell_action_library (
  id                  uuid primary key default gen_random_uuid(),
  category            text not null
                      check (category in ('eat','move','calm','avoid','sleep','home','medicine','follow-up')),
  label               text not null,
  description         text not null,
  destination_type    text not null
                      check (destination_type in ('route','voice','inline','concierge','game')),
  destination_path    text,
  condition_tags      text[] not null default array['all'],
  tier_min            integer not null default 1
                      check (tier_min between 1 and 4),
  avoid_after_done    integer not null default 1,
  avoid_after_skip    integer not null default 0,
  language            text not null default 'es',
  last_shown_at       timestamptz,
  last_outcome        text check (last_outcome in ('done','hard','skip', null)),
  is_active           boolean not null default false,
  created_at          timestamptz default now()
);

create index if not exists idx_aal_category_tags
  on public.agewell_action_library (category, condition_tags, tier_min, is_active);
`;

const dedupeSql = `
delete from public.agewell_action_library a
using (
  select id,
         row_number() over (
           partition by category, label, language
           order by created_at asc nulls last, id asc
         ) as duplicate_rank
  from public.agewell_action_library
) ranked
where a.id = ranked.id
  and ranked.duplicate_rank > 1;
`;

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query("begin");
  await client.query("set local search_path to public");
  await client.query(coreSql);
  await client.query(agewellActionTableSql);
  for (const insertSql of actionSeedInserts) {
    await client.query(insertSql);
  }
  await client.query(dedupeSql);
  await client.query(outcomesSql);
  await client.query(backendCleanupSql);
  await client.query(longevityPlanSql);
  await client.query(longevityIdentitySql);
  await client.query(longevityDailyContentSql);
  await client.query(longevityCompanionSql);
  await client.query(longevityContentUpgradeSql);
  await client.query("commit");

  const counts = await client.query(`
    select
      (select count(*)::int from public.condition_intelligence_profiles) as condition_profiles,
      (select count(*)::int from public.agewell_action_library) as action_rows,
      (select count(*)::int from public.longevity_daily_content where is_active = true) as active_longevity_content
  `);
  const row = counts.rows[0] ?? {};
  console.log(
    `Health insights schema ready: ${row.condition_profiles ?? 0} condition profiles, ${row.action_rows ?? 0} action rows, ${row.active_longevity_content ?? 0} active longevity content rows.`,
  );
} catch (error) {
  try {
    await client.query("rollback");
  } catch (_) {
    // The original error is more useful.
  }
  console.error(
    `Health insights schema failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
