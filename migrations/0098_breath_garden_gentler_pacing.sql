alter table public.breath_garden_sessions
  alter column guided_pattern_id set default 'gentle_5_6';

alter table public.breath_garden_sessions
  drop constraint if exists breath_garden_pattern_check;

alter table public.breath_garden_sessions
  add constraint breath_garden_pattern_check
  check (guided_pattern_id in ('gentle_4_6', 'gentle_5_6'));
