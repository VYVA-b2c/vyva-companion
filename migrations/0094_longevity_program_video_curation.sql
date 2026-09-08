create extension if not exists pgcrypto;

create table if not exists public.longevity_programs (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references public.profiles(id) on delete cascade,
  program_key   text not null default 'starter_video_longevity_v1',
  title         text not null,
  status        text not null default 'active' check (status in ('active','paused','completed')),
  focus_pillars text[] not null default array['heart','brain','strength','nourishment','calm'],
  start_date    date not null default current_date,
  current_day   integer not null default 1 check (current_day between 1 and 366),
  total_days    integer not null default 14 check (total_days between 1 and 366),
  language      text not null default 'en',
  cadence       text not null default 'daily',
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.longevity_programs is
  'One active program-led Longevity sequence per user, used to avoid repeating the same generic health plan each day.';

create unique index if not exists idx_longevity_programs_user_active_program
  on public.longevity_programs (user_id, program_key)
  where status = 'active';

create index if not exists idx_longevity_programs_user_status
  on public.longevity_programs (user_id, status, start_date desc);

create table if not exists public.longevity_program_days (
  id                 uuid primary key default gen_random_uuid(),
  program_id         uuid not null references public.longevity_programs(id) on delete cascade,
  user_id            text not null references public.profiles(id) on delete cascade,
  day_index          integer not null check (day_index between 1 and 366),
  pillar             text not null check (pillar in ('heart','brain','strength','nourishment','calm')),
  theme              text not null,
  objective          text not null,
  action_title       text not null,
  action_detail      text not null,
  video_query        text not null,
  fallback_video_key text not null,
  scheduled_date     date not null,
  status             text not null default 'scheduled' check (status in ('scheduled','shown','completed','skipped')),
  shown_at           timestamptz,
  completed_at       timestamptz,
  skipped_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint longevity_program_days_program_day_unique unique (program_id, day_index)
);

comment on table public.longevity_program_days is
  'Daily steps for the program-led Longevity plan, each paired with a curation query and fallback video key.';

create index if not exists idx_longevity_program_days_user_scheduled
  on public.longevity_program_days (user_id, scheduled_date);

create index if not exists idx_longevity_program_days_program_day
  on public.longevity_program_days (program_id, day_index);

create table if not exists public.longevity_video_resources (
  id               uuid primary key default gen_random_uuid(),
  program_day_id   uuid not null references public.longevity_program_days(id) on delete cascade,
  user_id          text not null references public.profiles(id) on delete cascade,
  provider         text not null default 'youtube' check (provider = 'youtube'),
  video_id         text not null,
  url              text not null,
  title            text not null,
  channel          text,
  duration_seconds integer,
  thumbnail_url    text,
  language         text not null default 'en',
  summary          text,
  selected_reason  text not null,
  safety_notes     text not null,
  curation_status  text not null default 'fallback' check (curation_status in ('ready','fallback','failed')),
  curator_agent    text not null default 'vyva-longevity-video-curator-v1',
  search_query     text not null,
  fetched_at       timestamptz not null default now(),
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  constraint longevity_video_resources_exact_youtube_url
    check (url ~ '^https://(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[A-Za-z0-9_-]{6,}')
);

comment on table public.longevity_video_resources is
  'Cached exact YouTube resources selected for Longevity program days by the video curator.';

create unique index if not exists idx_longevity_video_resources_day_video
  on public.longevity_video_resources (program_day_id, video_id);

create index if not exists idx_longevity_video_resources_user_created
  on public.longevity_video_resources (user_id, created_at desc);

alter table public.longevity_programs enable row level security;
alter table public.longevity_program_days enable row level security;
alter table public.longevity_video_resources enable row level security;

drop policy if exists longevity_programs_backend_owned on public.longevity_programs;
drop policy if exists longevity_program_days_backend_owned on public.longevity_program_days;
drop policy if exists longevity_video_resources_backend_owned on public.longevity_video_resources;

create policy longevity_programs_backend_owned on public.longevity_programs
  for all using (true) with check (true);

create policy longevity_program_days_backend_owned on public.longevity_program_days
  for all using (true) with check (true);

create policy longevity_video_resources_backend_owned on public.longevity_video_resources
  for all using (true) with check (true);
