create table if not exists home_plan_cards (
  id uuid primary key default gen_random_uuid(),
  card_id text not null unique,
  is_enabled boolean not null default true,
  emoji text not null default '*',
  bg text not null default '#F4F0FF',
  badge_bg text not null default '#EDE9FE',
  badge_text text not null default '#6D28D9',
  route text not null default '/',
  base_priority integer not null default 50,
  condition_keywords text[] not null default '{}',
  hobby_keywords text[] not null default '{}',
  avoid_condition_keywords text[] not null default '{}',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into home_plan_cards (
  card_id,
  is_enabled,
  emoji,
  bg,
  badge_bg,
  badge_text,
  route,
  base_priority,
  condition_keywords,
  hobby_keywords,
  avoid_condition_keywords,
  admin_notes
) values
  ('symptomCheck', true, '+', '#FFF7ED', '#FFEDD5', '#C2410C', '/health/symptom-check', 92, array['pain','dolor','mareo','dizzy','fever','fiebre','breath','respirar','shortness','chest','pecho'], '{}', '{}', 'Use when health signals suggest symptom review.'),
  ('meds', true, 'Rx', '#FDF4FF', '#FAE8FF', '#86198F', '/meds', 86, array['diabetes','hypertension','presion','heart','corazon'], '{}', '{}', 'Use when medication or chronic condition context is relevant.'),
  ('specialistFinder', true, 'Dr', '#F4F0FF', '#EDE9FE', '#6D28D9', '/health', 80, array['knee','rodilla','skin','piel','memory','memoria','thyroid','tiroides','diabetes','wound','herida'], '{}', '{}', 'Guide user to specialist search.'),
  ('gamesRoom', true, 'G', '#F0FDF4', '#DCFCE7', '#15803D', '/social-rooms/games-room', 74, '{}', array['chess','ajedrez','scrabble','game','juego','puzzle','sudoku','cards','cartas'], '{}', 'Social games and brain play.'),
  ('musicSalon', true, 'M', '#EEF4FF', '#DBEAFE', '#1D4ED8', '/social-rooms/music-salon', 70, '{}', array['music','musica','opera','song','cancion','singing'], '{}', 'Music social room recommendation.'),
  ('movement', true, 'Move', '#ECFDF5', '#D1FAE5', '#065F46', '/health', 68, '{}', array['walking','caminar','yoga','stretch','estirar','gardening','jardin'], array['fall','caida','wheelchair','silla de ruedas','mobility','movilidad'], 'Gentle movement only when mobility profile allows it.'),
  ('wordGame', true, 'W', '#F0FDF4', '#DCFCE7', '#15803D', '/activities', 64, '{}', array['reading','leer','book','libro','writing','escribir','poetry','poesia'], '{}', 'Light cognitive activity.'),
  ('billReview', true, '$', '#F0FDFA', '#CCFBF1', '#0F766E', '/concierge', 58, '{}', array['saving','ahorro','bills','facturas'], '{}', 'Savings and services review.'),
  ('social', true, 'S', '#FFFBEB', '#FEF3C7', '#B45309', '/social-rooms', 54, array['lonely','solo','sola','sad','triste','low mood','animo'], array['friends','amigos','conversation','conversacion','club'], '{}', 'Connection and social room prompt.'),
  ('breathing', true, 'B', '#EEF4FF', '#DBEAFE', '#1D4ED8', '/health', 50, array['stress','estres','anxiety','ansiedad','sleep','sueno'], '{}', '{}', 'Calm breathing support.'),
  ('concierge', true, 'C', '#F0FDFA', '#CCFBF1', '#0F766E', '/concierge', 44, '{}', '{}', '{}', 'General practical help.'),
  ('chatPrompt', true, 'Chat', '#F4F0FF', '#EDE9FE', '#6D28D9', '/chat', 40, '{}', '{}', '{}', 'Fallback chat prompt.')
on conflict (card_id) do update set
  emoji = excluded.emoji,
  bg = excluded.bg,
  badge_bg = excluded.badge_bg,
  badge_text = excluded.badge_text,
  route = excluded.route,
  base_priority = excluded.base_priority,
  condition_keywords = excluded.condition_keywords,
  hobby_keywords = excluded.hobby_keywords,
  avoid_condition_keywords = excluded.avoid_condition_keywords,
  admin_notes = coalesce(home_plan_cards.admin_notes, excluded.admin_notes),
  updated_at = now();

create index if not exists home_plan_cards_enabled_priority_idx
  on home_plan_cards (is_enabled, base_priority desc);
