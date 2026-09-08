alter table public.breath_garden_sessions
  add column if not exists target_duration_seconds integer not null default 120,
  add column if not exists guided_cycle_count integer not null default 0,
  add column if not exists guided_pattern_id text not null default 'gentle_4_6',
  add column if not exists completion_reason text not null default 'timer_complete';

alter table public.breath_garden_user_state
  add column if not exists preferred_duration_seconds integer not null default 120;

alter table public.cognitive_session_index
  alter column score drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'breath_garden_target_duration_check') then
    alter table public.breath_garden_sessions
      add constraint breath_garden_target_duration_check check (target_duration_seconds in (60, 120, 300));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'breath_garden_pattern_check') then
    alter table public.breath_garden_sessions
      add constraint breath_garden_pattern_check check (guided_pattern_id = 'gentle_4_6');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'breath_garden_completion_reason_check') then
    alter table public.breath_garden_sessions
      add constraint breath_garden_completion_reason_check check (completion_reason in ('timer_complete', 'finished_early', 'exited'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'breath_garden_preferred_duration_check') then
    alter table public.breath_garden_user_state
      add constraint breath_garden_preferred_duration_check check (preferred_duration_seconds in (60, 120, 300));
  end if;
end $$;
