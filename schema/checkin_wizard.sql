-- VYVA Daily Wellness Check-in Wizard
-- Run in Supabase SQL editor before relying on persistence.

create table if not exists checkin_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(id) on delete cascade,
  completed_at timestamptz default now(),

  energy_level integer check (energy_level between 1 and 5),
  mood text,
  body_areas text[],
  sleep_quality text,
  symptoms text[],
  social_contact text,

  feeling_label text,
  overall_state text,
  vyva_reading text,
  right_now jsonb,
  today_actions jsonb,
  highlight text,
  flag_caregiver boolean not null default false,
  watch_for text,

  language text not null default 'es',
  completed boolean not null default false,
  abandoned boolean not null default false,
  duration_seconds integer
);

create table if not exists checkin_trend_state (
  user_id text primary key references profiles(id) on delete cascade,
  streak_days integer not null default 0,
  best_streak integer not null default 0,
  last_checkin_date date,
  total_checkins integer not null default 0,
  avg_energy_7d numeric(3,1),
  avg_mood_score_7d numeric(3,1),
  consecutive_low_energy integer not null default 0,
  consecutive_poor_sleep integer not null default 0,
  consecutive_no_social integer not null default 0,
  consecutive_low_mood integer not null default 0,
  caregiver_flag_active boolean not null default false,
  flag_reason text,
  flag_triggered_at timestamptz,
  updated_at timestamptz default now()
);

alter table checkin_sessions enable row level security;
alter table checkin_trend_state enable row level security;

drop policy if exists "user_own_checkins" on checkin_sessions;
create policy "user_own_checkins"
  on checkin_sessions
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists "user_own_trend_state" on checkin_trend_state;
create policy "user_own_trend_state"
  on checkin_trend_state
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create index if not exists idx_cs_user_date on checkin_sessions (user_id, completed_at desc);
create index if not exists idx_cs_flag on checkin_sessions (user_id, flag_caregiver) where flag_caregiver = true;
