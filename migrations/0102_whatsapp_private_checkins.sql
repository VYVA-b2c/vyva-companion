create table if not exists whatsapp_private_checkins (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  request_key_hash text not null unique,
  communication_id uuid references communications_log(id) on delete set null,
  recipient text not null,
  language text not null check (language in ('en', 'es', 'de', 'fr')),
  workflow_id text not null,
  workflow_name text not null,
  step_id text not null,
  step_name text not null,
  questions jsonb not null default '[]'::jsonb,
  response_payload jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'completed', 'expired', 'failed')),
  whatsapp_opt_in_confirmed_at timestamptz not null,
  whatsapp_opt_in_source text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_private_checkins_status_expires_idx
  on whatsapp_private_checkins (status, expires_at);

create index if not exists whatsapp_private_checkins_workflow_step_idx
  on whatsapp_private_checkins (workflow_id, step_id, created_at desc);
