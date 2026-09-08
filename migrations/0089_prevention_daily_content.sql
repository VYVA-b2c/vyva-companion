create extension if not exists pgcrypto;

create table if not exists public.longevity_daily_content (
  id              uuid primary key default gen_random_uuid(),
  content_type    text not null check (content_type in ('exercise','meal','tip','article')),
  title           text not null,
  description     text not null,
  detail_text     text,
  source_label    text,
  source_url      text,
  condition_tags  text[] not null default array['all'],
  pillar_tag      text check (pillar_tag is null or pillar_tag in ('heart','brain','strength','nourishment','calm')),
  time_of_day     text not null default 'any' check (time_of_day in ('morning','afternoon','evening','any')),
  language        text not null default 'es',
  rotation_weight integer not null default 1,
  is_active       boolean not null default false,
  created_at      timestamptz not null default now()
);

comment on table public.longevity_daily_content is
  'Clinician-reviewed daily longevity content. Rows ship inactive until approved.';

create index if not exists idx_ldc_type_language_active
  on public.longevity_daily_content (content_type, language, is_active);

create index if not exists idx_ldc_condition_tags
  on public.longevity_daily_content using gin (condition_tags);

create unique index if not exists idx_ldc_unique_seed_content
  on public.longevity_daily_content (content_type, title, language);

create table if not exists public.longevity_daily_content_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references public.profiles(id) on delete cascade,
  content_id uuid not null references public.longevity_daily_content(id) on delete cascade,
  shown_on   date not null default current_date,
  engaged    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, content_id, shown_on)
);

comment on table public.longevity_daily_content_log is
  'Backend-owned audit of daily content shown and tapped by health profile.';

create index if not exists idx_ldcl_user_date
  on public.longevity_daily_content_log (user_id, shown_on desc);

create table if not exists public.longevity_synthesis_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references public.profiles(id) on delete cascade,
  trigger_type  text not null check (trigger_type in (
    'symptom_logged',
    'vitals_deviation',
    'adherence_drop',
    'cognitive_drop',
    'mood_decline',
    'user_requested',
    'scheduled'
  )),
  trigger_data  jsonb,
  synthesis_ran boolean not null default false,
  created_at    timestamptz not null default now()
);

comment on table public.longevity_synthesis_events is
  'Audit trail for event-driven longevity plan synthesis; Express routes enforce profile access.';

create index if not exists idx_lse_user_recent_run
  on public.longevity_synthesis_events (user_id, created_at desc)
  where synthesis_ran = true;

alter table public.longevity_daily_content enable row level security;
alter table public.longevity_daily_content_log enable row level security;
alter table public.longevity_synthesis_events enable row level security;

drop policy if exists content_read_active on public.longevity_daily_content;
drop policy if exists log_backend_owned on public.longevity_daily_content_log;
drop policy if exists events_backend_owned on public.longevity_synthesis_events;

create policy content_read_active on public.longevity_daily_content
  for select using (is_active = true);

create policy log_backend_owned on public.longevity_daily_content_log
  for all using (true) with check (true);

create policy events_backend_owned on public.longevity_synthesis_events
  for all using (true) with check (true);

insert into public.longevity_daily_content
  (content_type, title, description, detail_text, condition_tags, pillar_tag, time_of_day, language, rotation_weight)
values
('exercise','Estiramiento sentado — 10 minutos',
 'Movimiento suave para articulaciones y circulación. Se hace desde cualquier silla.',
 'Empieza con los hombros: gíralos hacia atrás 5 veces. Luego inclina suavemente el cuello a cada lado. Finaliza con círculos de tobillo sentado. Total: 10 minutos.',
 array['all'],'heart','morning','es',2),
('exercise','Caminar después de comer — 10 minutos',
 'Un paseo corto tras la comida reduce la presión arterial y el azúcar en sangre.',
 'Sal a caminar a paso tranquilo en los 30 minutos siguientes a comer. No hace falta ir rápido — el movimiento es lo que importa.',
 array['heart','diabetes'],'heart','any','es',3),
('exercise','Ejercicios de equilibrio en la encimera — 5 minutos',
 'Mejora la estabilidad y reduce el riesgo de caídas con apoyo.',
 'De pie frente a la encimera, apoya las manos ligeramente. Levanta un pie despacio y mantén 10 segundos. Repite 5 veces por cada lado.',
 array['falls'],'strength','morning','es',2),
('exercise','Respiración lenta — 2 minutos',
 'Inhala 4 tiempos, aguanta 4, exhala 6. Calma el sistema nervioso en minutos.',
 'Busca un lugar tranquilo. Inhala por la nariz 4 tiempos, aguanta 4, exhala lentamente por la boca 6 tiempos. Repite 6 veces.',
 array['anxiety','calm','all'],'calm','any','es',3),
('exercise','Estiramiento de caderas sentado — 8 minutos',
 'Reduce la rigidez de cadera y mejora la movilidad general.',
 'Sentado en una silla firme, cruza un tobillo sobre la rodilla contraria. Inclínate suavemente hacia adelante hasta sentir el estiramiento. Mantén 30 segundos por lado.',
 array['falls','strength'],'strength','morning','es',1),
('exercise','Respiración diafragmática — 5 minutos',
 'Respiración profunda desde el abdomen para reducir la tensión arterial.',
 'Pon una mano en el pecho y otra en el abdomen. Inhala por la nariz — el abdomen debe subir, no el pecho. Exhala lentamente. Repite durante 5 minutos.',
 array['heart','anxiety'],'calm','any','es',2)
on conflict (content_type, title, language) do nothing;

insert into public.longevity_daily_content
  (content_type, title, description, detail_text, condition_tags, pillar_tag, language, rotation_weight)
values
('meal','Sardinas en pan de centeno',
 'Alto en omega-3 y bajo en sodio. Bueno para el corazón y fácil de preparar.',
 'Tuesta una rebanada de pan de centeno. Añade una lata de sardinas al natural, unas rodajas de tomate y un chorrito de limón. Sin sal añadida — las sardinas ya tienen suficiente sabor.',
 array['heart'],'heart','es',2),
('meal','Desayuno proteico: huevo y aguacate',
 'Proteína y grasas saludables para un comienzo estable del azúcar en sangre.',
 'Dos huevos revueltos o a la plancha con medio aguacate en rodajas. Acompaña con una tostada integral. Sin zumos — mejor agua o infusión.',
 array['diabetes','all'],'nourishment','es',3),
('meal','Yogur natural con nueces y arándanos',
 'Probióticos para el intestino, antioxidantes para el cerebro.',
 'Usa yogur natural sin azúcar. Añade un puñado de nueces (5-6 mitades) y arándanos frescos o congelados. No añadas miel si hay diabetes.',
 array['brain','alzheimers','all'],'brain','es',2),
('meal','Sopa de lentejas con verduras',
 'Alta en proteína vegetal, fibra y potasio. Ideal para el corazón y los músculos.',
 'Cocina lentejas con zanahoria, apio, cebolla y un diente de ajo. Aliña con aceite de oliva virgen extra y pimentón. Evita añadir sal — usa hierbas aromáticas.',
 array['heart','falls','all'],'nourishment','es',2),
('meal','Caballa al horno con patata',
 'Omega-3, vitamina D y potasio en un solo plato. Sencillo y nutritivo.',
 'Coloca un lomo de caballa sobre una cama de patata en rodajas finas. Añade aceite de oliva, ajo y romero. Hornea a 180°C durante 20 minutos.',
 array['heart','diabetes'],'heart','es',1),
('meal','Batido de plátano, espinacas y leche',
 'Magnesio, potasio y proteína. Hidratación y energía en un vaso.',
 'Mezcla un plátano maduro, un puñado de espinacas frescas y un vaso de leche o bebida de avena. No añadas azúcar. El plátano ya endulza suficiente.',
 array['falls','strength','all'],'strength','es',1)
on conflict (content_type, title, language) do nothing;

insert into public.longevity_daily_content
  (content_type, title, description, condition_tags, pillar_tag, language, rotation_weight)
values
('tip','Beber agua antes de cada comida',
 'Reduce el tamaño de la comida de forma natural y apoya la función renal.',
 array['all'],'nourishment','es',3),
('tip','Salir a la luz natural por la mañana',
 'Diez minutos de luz solar al levantarte regula el ritmo circadiano y mejora el sueño nocturno.',
 array['all'],'calm','es',3),
('tip','Revisar los medicamentos con el médico cada 6 meses',
 'Cinco o más medicamentos aumentan el riesgo de caídas y efectos secundarios. Una revisión periódica puede simplificar mucho.',
 array['all'],'heart','es',2),
('tip','Comer sentado y sin pantallas',
 'Comer despacio y con atención mejora la digestión y reduce el consumo de sal sin esfuerzo.',
 array['all'],'nourishment','es',2),
('tip','Llamar a alguien hoy',
 'La conexión social reduce el riesgo de demencia tanto como el ejercicio físico. Una llamada cuenta.',
 array['all','alzheimers'],'brain','es',3),
('tip','Acostarse y levantarse a la misma hora',
 'La regularidad del sueño estabiliza el azúcar en sangre, el estado de ánimo y la memoria — independientemente de cuánto duermas.',
 array['all','diabetes'],'calm','es',3),
('tip','Añadir proteína al desayuno',
 'El desayuno proteico reduce el apetito el resto del día y protege la masa muscular.',
 array['all','falls'],'strength','es',2),
('tip','Comprobar el camino de casa cada semana',
 'Retirar alfombras sueltas y cables del suelo es la intervención de prevención de caídas más eficaz disponible.',
 array['falls'],'strength','es',2)
on conflict (content_type, title, language) do nothing;

insert into public.longevity_daily_content
  (content_type, title, description, source_label, source_url, condition_tags, pillar_tag, language, rotation_weight)
values
('article',
 'Caminar tras las comidas reduce los picos de presión arterial hasta un 22%',
 'Un metaanálisis de 2024 muestra que incluso 10 minutos de caminata en los 30 minutos posteriores a comer reduce significativamente la tensión cardiovascular en personas con hipertensión.',
 'European Heart Journal, 2024',
 'https://academic.oup.com/eurheartj',
 array['heart'],'heart','es',2),
('article',
 'Dormir a la misma hora reduce el azúcar en sangre más que solo cambiar la dieta',
 'Variar la hora de acostarse más de 90 minutos aumenta los marcadores glucémicos independientemente de lo que se come. El sueño regular es medicina metabólica.',
 'Diabetes Care, 2024',
 'https://diabetesjournals.org/care',
 array['diabetes'],'calm','es',2),
('article',
 'El ejercicio reduce el riesgo de demencia en un 35% independientemente de otros factores',
 '150 minutos semanales de actividad física moderada reduce el riesgo de deterioro cognitivo más que cualquier suplemento o intervención farmacológica en personas mayores.',
 'The Lancet, 2024',
 'https://www.thelancet.com',
 array['alzheimers','brain','all'],'brain','es',3),
('article',
 'La soledad aumenta el riesgo de muerte prematura tanto como fumar 15 cigarrillos al día',
 'Una revisión de más de 3 millones de personas confirma que el aislamiento social es un factor de riesgo cardiovascular y cognitivo tan potente como el tabaquismo.',
 'PLOS Medicine, 2015 — sigue siendo la referencia estándar',
 'https://journals.plos.org/plosmedicine',
 array['all'],'calm','es',2),
('article',
 'La proteína en mayores de 65 años debe superar 1,6 g por kg de peso corporal',
 'La mayoría de personas mayores consumen menos de la mitad de la proteína necesaria para mantener la masa muscular. La deficiencia acelera la sarcopenia y el riesgo de caídas.',
 'Journal of Nutrition, Health and Aging, 2023',
 'https://link.springer.com/journal/12603',
 array['falls','strength','all'],'strength','es',2),
('article',
 'El HRV (variabilidad de la frecuencia cardíaca) predice el riesgo cardiovascular mejor que la presión arterial en mayores',
 'Un HRV en descenso sostenido durante semanas es un marcador temprano de estrés cardiovascular y autonómico, detectable meses antes de que aparezcan síntomas clínicos.',
 'American Journal of Cardiology, 2023',
 'https://www.ajconline.org',
 array['heart'],'heart','es',1)
on conflict (content_type, title, language) do nothing;
