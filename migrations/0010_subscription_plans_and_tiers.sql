alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'trial',
  add column if not exists subscription_tier text not null default 'trial',
  add column if not exists trial_ends_at timestamptz;

alter table public.profiles
  alter column subscription_status set default 'trial',
  alter column subscription_tier set default 'trial';

update public.profiles
set subscription_tier = 'trial'
where subscription_tier = 'free';

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  plan_id text not null unique,
  name text not null,
  description text,
  price_eur integer not null default 0,
  price_gbp integer not null default 0,
  billing_interval text default 'month',
  trial_days integer default 14,
  stripe_price_id_eur text,
  stripe_price_id_gbp text,
  features text[],
  is_active boolean not null default true,
  is_public boolean not null default true,
  sort_order integer default 0
);

create table if not exists public.tier_entitlements (
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

create index if not exists subscription_plans_public_idx
  on public.subscription_plans(is_active, is_public, sort_order);

create index if not exists tier_entitlements_active_idx
  on public.tier_entitlements(is_active, tier);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id text not null,
  stripe_event_id text unique,
  stripe_invoice_id text,
  stripe_charge_id text,
  event_type text not null,
  amount_cents integer,
  currency text,
  plan_id text,
  status text not null,
  failure_reason text,
  stripe_payload jsonb default '{}'::jsonb
);

create table if not exists public.stripe_webhooks (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  stripe_event_id text not null unique,
  event_type text not null,
  status text not null default 'pending',
  error text,
  payload jsonb not null default '{}'::jsonb
);

insert into public.subscription_plans (
  plan_id, name, description, price_eur, price_gbp, billing_interval, trial_days,
  features, is_active, is_public, sort_order
) values
  (
    'trial',
    'Free trial',
    'A time-limited introduction to VYVA with core companion tools.',
    0,
    0,
    'month',
    14,
    array['Daily companion conversations', 'Medication reminders', 'Basic wellbeing check-ins'],
    true,
    true,
    0
  ),
  (
    'essential',
    'Essential',
    'Everyday support for health, medication, and daily routines.',
    1900,
    1600,
    'month',
    0,
    array['Everything in trial', 'Ongoing medication tracking', 'Symptom checks', 'Priority app support'],
    true,
    true,
    10
  ),
  (
    'unlimited',
    'Unlimited',
    'Full VYVA access with concierge support and caregiver visibility.',
    2900,
    2499,
    'month',
    0,
    array['Everything in Essential', 'Concierge support', 'Caregiver dashboard', 'Family access'],
    true,
    true,
    20
  ),
  (
    'custom',
    'Custom',
    'Private plan for organizations, pilots, or bespoke care bundles.',
    0,
    0,
    'month',
    0,
    array['Configured by VYVA operations'],
    true,
    false,
    90
  )
on conflict (plan_id) do nothing;

insert into public.tier_entitlements (
  tier, display_name, description, voice_assistant, medication_tracking,
  symptom_check, concierge, caregiver_dashboard, custom_features, is_active
) values
  ('trial', 'Free trial', 'Core voice, health, and reminder features during the free trial.', true, true, true, false, false, '{}'::jsonb, true),
  ('essential', 'Essential', 'Core paid plan for ongoing daily support.', true, true, true, false, false, '{}'::jsonb, true),
  ('unlimited', 'Unlimited', 'Full VYVA support bundle.', true, true, true, true, true, '{}'::jsonb, true),
  ('custom', 'Custom', 'Operations-managed bespoke entitlement bundle.', false, false, false, false, false, '{}'::jsonb, true)
on conflict (tier) do nothing;
