-- VYVA admin lifecycle completion: account status + scheduled events.
-- Safe to run more than once.

alter table profiles
  add column if not exists account_status text not null default 'enabled',
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text,
  add column if not exists disabled_by text;

create table if not exists scheduled_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  event_type text not null,
  title text not null,
  description text,
  channel text not null default 'app',
  agent_id text,
  agent_slug text,
  room_slug text,
  scheduled_for timestamptz not null,
  timezone text not null default 'Europe/Madrid',
  recurrence text not null default 'none',
  status text not null default 'upcoming',
  source text not null default 'app',
  source_session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scheduled_event_logs (
  id uuid primary key default gen_random_uuid(),
  scheduled_event_id uuid,
  user_id text not null,
  action text not null,
  status text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_events_user_status_idx on scheduled_events(user_id, status);
create index if not exists scheduled_events_scheduled_for_idx on scheduled_events(scheduled_for);
create index if not exists scheduled_event_logs_event_idx on scheduled_event_logs(scheduled_event_id);
