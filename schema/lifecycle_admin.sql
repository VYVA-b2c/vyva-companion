-- VYVA unified signup, access, and admin lifecycle layer.
-- Safe to run more than once.

do $$ begin
  create type lifecycle_entry_point as enum ('form', 'phone', 'whatsapp', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lifecycle_user_type as enum ('elder', 'family', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lifecycle_status as enum ('created', 'link_sent', 'consent_pending', 'active', 'dropped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type access_link_type as enum ('trial', 'unlimited', 'organization', 'custom', 'caregiver');
exception when duplicate_object then null; end $$;

do $$ begin
  create type consent_attempt_status as enum ('pending', 'approved', 'rejected', 'no_answer', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  contact_name text,
  contact_email text,
  contact_phone text,
  default_tier text not null default 'trial',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tier_entitlements (
  id uuid primary key default gen_random_uuid(),
  tier text not null unique,
  display_name text not null,
  description text,
  voice_assistant boolean not null default false,
  medication_tracking boolean not null default false,
  symptom_check boolean not null default false,
  concierge boolean not null default false,
  caregiver_dashboard boolean not null default false,
  custom_features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  elder_user_id text,
  family_user_id text,
  name text not null,
  phone text not null,
  email text,
  user_type lifecycle_user_type not null default 'elder',
  entry_point lifecycle_entry_point not null default 'form',
  organization_id uuid references organizations(id) on delete set null,
  tier text not null default 'trial',
  status lifecycle_status not null default 'created',
  journey_step text not null default 'created',
  consent_status text not null default 'not_required',
  source_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  link_sent_at timestamptz,
  activated_at timestamptz,
  dropped_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists access_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  user_id text,
  intake_id uuid references user_intakes(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  link_type access_link_type not null default 'trial',
  tier text not null default 'trial',
  destination text not null default '/onboarding',
  target_role text not null default 'elder',
  max_uses integer not null default 1,
  use_count integer not null default 0,
  clicked_at timestamptz,
  converted_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid references user_intakes(id) on delete set null,
  user_id text,
  event_type text not null,
  from_status text,
  to_status text,
  channel text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists consent_attempts (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid references user_intakes(id) on delete set null,
  elder_user_id text,
  family_user_id text,
  attempt_number integer not null default 1,
  status consent_attempt_status not null default 'pending',
  channel text not null default 'voice',
  scheduled_at timestamptz,
  completed_at timestamptz,
  source_session_id text,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists communications_log (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid references user_intakes(id) on delete set null,
  user_id text,
  channel text not null,
  recipient text not null,
  purpose text not null,
  status text not null default 'queued',
  provider_message_id text,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

insert into tier_entitlements (
  tier, display_name, description, voice_assistant, medication_tracking,
  symptom_check, concierge, caregiver_dashboard
) values
  ('trial', 'Trial', 'Default trial access', true, true, true, true, false),
  ('unlimited', 'Unlimited', 'Full access without payment requirement', true, true, true, true, true),
  ('custom', 'Custom', 'Admin-controlled entitlement bundle', false, false, false, false, false)
on conflict (tier) do nothing;

create index if not exists user_intakes_status_idx on user_intakes(status);
create index if not exists user_intakes_entry_point_idx on user_intakes(entry_point);
create index if not exists user_intakes_phone_idx on user_intakes(phone);
create index if not exists access_links_token_idx on access_links(token);
create index if not exists lifecycle_events_intake_idx on lifecycle_events(intake_id);
create index if not exists consent_attempts_intake_idx on consent_attempts(intake_id);
create index if not exists communications_log_intake_idx on communications_log(intake_id);
