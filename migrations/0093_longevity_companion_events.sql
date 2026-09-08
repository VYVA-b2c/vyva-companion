create extension if not exists pgcrypto;

create table if not exists public.longevity_action_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null references public.profiles(id) on delete cascade,
  plan_id        uuid references public.longevity_prevention_plans(id) on delete set null,
  pillar         text check (pillar is null or pillar in ('heart','brain','strength','nourishment','calm')),
  action_key     text not null,
  action_title   text not null,
  event_type     text not null check (event_type in ('shown','opened','done','too_hard','not_relevant')),
  barrier        text,
  source_context jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

comment on table public.longevity_action_events is
  'Backend-owned event memory for Longevity plan actions, used to avoid repeating rejected steps and adapt future daily support.';

create index if not exists idx_longevity_action_events_user_created
  on public.longevity_action_events (user_id, created_at desc);

create index if not exists idx_longevity_action_events_user_action_created
  on public.longevity_action_events (user_id, action_key, created_at desc);

alter table public.longevity_action_events enable row level security;

drop policy if exists longevity_action_events_backend_owned on public.longevity_action_events;

create policy longevity_action_events_backend_owned on public.longevity_action_events
  for all using (true) with check (true);

alter table public.longevity_daily_content
  alter column is_active set default true;

update public.longevity_daily_content
set is_active = true
where content_type in ('exercise','meal','tip')
  and language in ('es','en');

insert into public.longevity_daily_content
  (content_type, title, description, detail_text, condition_tags, pillar_tag, time_of_day, language, rotation_weight, is_active)
values
('exercise','Walk after lunch',
 'Ten steady minutes after a meal is a practical first step.',
 'Keep the pace easy. Stop if you feel unwell, dizzy, or short of breath.',
 array['all','heart','diabetes'],'heart','afternoon','en',3,true),
('exercise','Step outside for five minutes',
 'A short outdoor walk gives the heart step a clear place and time.',
 'Keep it easy and close to home. Sit down if your body asks for it.',
 array['all','heart'],'heart','morning','en',2,true),
('tip','Put the BP cuff where you sit',
 'If you track readings at home, keeping the cuff visible makes the routine easier.',
 null,
 array['all','heart'],'heart','morning','en',2,true),
('tip','Save one heart question',
 'One saved question makes the next visit easier to use well.',
 null,
 array['all','heart','diabetes'],'heart','any','en',2,true),
('tip','One familiar Brain Coach round',
 'A familiar activity keeps today''s brain step low effort.',
 null,
 array['all','brain','alzheimers'],'brain','any','en',3,true),
('tip','Name three photos from yesterday',
 'A tiny recall cue keeps memory practice useful without adding a new app step.',
 null,
 array['all','brain','alzheimers'],'brain','evening','en',2,true),
('tip','Call someone you enjoy',
 'A warm conversation supports memory, mood, and routine.',
 null,
 array['all','brain','calm'],'brain','afternoon','en',2,true),
('tip','Ten quiet minutes with a memory game',
 'A short familiar game gives the brain a gentle challenge today.',
 null,
 array['all','brain'],'brain','any','en',2,true),
('exercise','Supported chair strength',
 'One seated round keeps movement simple when energy is lower.',
 'Sit tall, stand if comfortable, or press your feet gently into the floor. Keep it light.',
 array['all','falls','strength'],'strength','morning','en',3,true),
('exercise','Stand once during the next advert',
 'One supported stand is enough to keep the strength step alive today.',
 'Use a stable chair or counter. Skip it if standing does not feel comfortable.',
 array['all','falls','strength'],'strength','evening','en',2,true),
('tip','Clear one walking path',
 'One clear route at home makes movement easier and steadier.',
 null,
 array['all','falls','strength'],'strength','evening','en',3,true),
('tip','Put walking shoes by the door',
 'A visible cue makes the next short walk easier to start.',
 null,
 array['all','falls','strength'],'strength','morning','en',2,true),
('meal','Protein with the next meal',
 'Choose one familiar protein food so nourishment does not become complicated.',
 'Eggs, yogurt, beans, fish, tofu, or chicken all count.',
 array['all','diabetes','falls','strength'],'nourishment','any','en',3,true),
('exercise','Two-minute breathing reset',
 'A short breathing pause is enough when the plan needs to stay small.',
 'Breathe in gently, then exhale slowly. Repeat for two minutes.',
 array['all','anxiety','calm'],'calm','any','en',3,true),
('meal','Protein at breakfast',
 'Eggs, yogurt, beans, or fish can make the first meal steadier.',
 'Choose one familiar protein food. Keep the meal simple.',
 array['all','diabetes','falls','strength'],'nourishment','morning','en',3,true),
('meal','Water where you sit',
 'Keeping water nearby makes hydration easier to remember.',
 'Place a glass or bottle near the chair or table you use most.',
 array['all'],'nourishment','any','en',2,true),
('meal','Add one colour to the next plate',
 'One fruit or vegetable keeps the food step visible and simple.',
 'Choose whatever is already easy to prepare.',
 array['all','diabetes'],'nourishment','any','en',2,true),
('tip','Place a snack beside your water',
 'A simple pairing makes nourishment easier when appetite is lower.',
 null,
 array['all','nourishment'],'nourishment','afternoon','en',2,true),
('tip','Same bedtime tonight',
 'A familiar evening time supports tomorrow''s energy and attention.',
 null,
 array['all','calm','diabetes'],'calm','evening','en',2,true),
('tip','Choose tonight''s wind-down time',
 'A clear evening cue makes rest support easier to repeat.',
 null,
 array['all','calm'],'calm','evening','en',2,true),
('tip','Ten minutes of morning light',
 'A simple morning cue can support daytime rhythm and evening rest.',
 null,
 array['all','calm'],'calm','morning','en',2,true),
('tip','One quiet pause after breakfast',
 'Anchoring calm to breakfast makes the step easier to remember.',
 null,
 array['all','calm'],'calm','morning','en',2,true)
on conflict (content_type, title, language) do update
set description = excluded.description,
    detail_text = excluded.detail_text,
    condition_tags = excluded.condition_tags,
    pillar_tag = excluded.pillar_tag,
    time_of_day = excluded.time_of_day,
    rotation_weight = excluded.rotation_weight,
    is_active = true;
