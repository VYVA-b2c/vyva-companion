import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  `
    create table if not exists users (
      id text primary key default gen_random_uuid()::text,
      email text,
      phone_number text,
      password_hash text,
      active_profile_id text,
      onboarding_intent text,
      reset_token text,
      reset_token_expires_at timestamptz,
      last_seen_at timestamptz,
      created_at timestamptz not null default now()
    )
  `,
  `alter table users add column if not exists email text`,
  `alter table users add column if not exists phone_number text`,
  `alter table users add column if not exists password_hash text`,
  `alter table users add column if not exists active_profile_id text`,
  `alter table users add column if not exists onboarding_intent text`,
  `alter table users add column if not exists reset_token text`,
  `alter table users add column if not exists reset_token_expires_at timestamptz`,
  `alter table users add column if not exists last_seen_at timestamptz`,
  `alter table users add column if not exists created_at timestamptz not null default now()`,
  `
    create unique index if not exists users_email_unique
    on users (lower(email))
    where email is not null
  `,
  `
    create unique index if not exists users_phone_number_unique
    on users (phone_number)
    where phone_number is not null
  `,
  `
    create unique index if not exists users_reset_token_unique
    on users (reset_token)
    where reset_token is not null
  `,
  `
    create table if not exists password_reset_tokens (
      id text primary key default gen_random_uuid()::text,
      user_id text not null,
      token text not null,
      used boolean not null default false,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `,
  `alter table password_reset_tokens add column if not exists user_id text`,
  `alter table password_reset_tokens add column if not exists token text`,
  `alter table password_reset_tokens add column if not exists used boolean not null default false`,
  `alter table password_reset_tokens add column if not exists expires_at timestamptz`,
  `alter table password_reset_tokens add column if not exists created_at timestamptz not null default now()`,
  `
    create unique index if not exists password_reset_tokens_token_unique
    on password_reset_tokens (token)
  `,
];

try {
  for (const statement of statements) {
    await pool.query(statement);
  }
  console.log("Auth database setup completed safely.");
} catch (error) {
  console.error("Auth database setup failed:");
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
