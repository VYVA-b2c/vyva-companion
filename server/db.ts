import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL
  ?? process.env.POSTGRES_PRISMA_URL
  ?? process.env.POSTGRES_URL_NON_POOLING;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or a Vercel Postgres URL must be set. For local admin login, create a .env file from .env.example and set DATABASE_URL to a reachable PostgreSQL database before starting the API server.",
  );
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });
