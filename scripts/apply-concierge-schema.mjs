import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = await readFile(new URL("../schema/concierge_layer1.sql", import.meta.url), "utf8");

try {
  await client.connect();
  await client.query(sql);
  console.log("Concierge schema applied successfully.");
} catch (error) {
  console.error("Failed to apply concierge schema.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
