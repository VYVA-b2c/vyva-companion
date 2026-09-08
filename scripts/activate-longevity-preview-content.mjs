import "dotenv/config";
import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query("begin");
  await client.query(`
    update public.longevity_daily_content
    set is_active = true
    where id in (
      select id from (
        select id,
               row_number() over (
                 partition by content_type
                 order by rotation_weight desc, title asc
               ) as row_rank
        from public.longevity_daily_content
        where language = 'es'
          and content_type in ('exercise','meal','tip','article','supplement','natural_solution')
      ) ranked
      where row_rank <= 2
    );
  `);
  await client.query("commit");

  const counts = await client.query(`
    select content_type, count(*)::int as active_count
    from public.longevity_daily_content
    where is_active = true
      and language = 'es'
      and content_type in ('exercise','meal','tip','article','supplement','natural_solution')
    group by content_type
    order by content_type;
  `);

  console.log("Activated longevity preview content:");
  for (const row of counts.rows) {
    console.log(`- ${row.content_type}: ${row.active_count}`);
  }
} catch (error) {
  try {
    await client.query("rollback");
  } catch (_) {
    // The original error is more useful.
  }
  console.error(`Longevity preview activation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
