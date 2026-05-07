create extension if not exists pgcrypto;

create table if not exists spatial_nav_maps (
  id uuid primary key default gen_random_uuid(),
  grid_cols integer not null,
  grid_rows integer not null,
  route_nodes jsonb not null,
  step_count integer not null,
  difficulty_tier integer not null check (difficulty_tier between 1 and 10),
  blocked_cells jsonb,
  landmark_cells jsonb,
  memorise_seconds integer not null default 5,
  language text not null default 'es',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists spatial_nav_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  played_at timestamptz default now(),
  map_id uuid references spatial_nav_maps(id),
  difficulty_tier integer not null,
  step_count integer not null,
  steps_correct integer not null,
  accuracy_pct numeric(5, 2),
  draw_time_seconds numeric(6, 2),
  completed boolean not null default false,
  abandoned boolean not null default false,
  score integer
);

create table if not exists spatial_nav_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_tier integer not null default 1 check (current_tier between 1 and 10),
  sessions_at_tier integer not null default 0,
  consecutive_wins integer not null default 0,
  consecutive_losses integer not null default 0,
  total_sessions integer not null default 0,
  best_score integer not null default 0,
  last_played_at timestamptz,
  streak_days integer not null default 0,
  last_streak_date date,
  updated_at timestamptz default now()
);

alter table spatial_nav_sessions enable row level security;
alter table spatial_nav_user_state enable row level security;
alter table spatial_nav_maps enable row level security;

drop policy if exists user_own_sn_sessions on spatial_nav_sessions;
create policy user_own_sn_sessions on spatial_nav_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_own_sn_state on spatial_nav_user_state;
create policy user_own_sn_state on spatial_nav_user_state
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists sn_maps_read on spatial_nav_maps;
create policy sn_maps_read on spatial_nav_maps
  for select using (auth.role() = 'authenticated');

create index if not exists idx_sns_user_played on spatial_nav_sessions (user_id, played_at desc);
create index if not exists idx_snm_tier on spatial_nav_maps (difficulty_tier, is_active);
create index if not exists idx_snm_language_tier on spatial_nav_maps (language, difficulty_tier, is_active);
