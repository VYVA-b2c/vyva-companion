create table if not exists benefits_programs (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  region text,
  name jsonb not null,
  description jsonb not null,
  eligibility_rules jsonb not null default '[]'::jsonb,
  is_active boolean not null default false
);

create index if not exists benefits_programs_active_country_region_idx
  on benefits_programs (is_active, country, region);

create table if not exists benefits_screening_responses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists benefits_screening_responses_user_created_idx
  on benefits_screening_responses (user_id, created_at desc);

insert into benefits_programs (id, country, region, name, description, eligibility_rules, is_active)
values
  (
    '11000000-0000-4000-8000-000000000001',
    'ES', null,
    '{"en":"Non-contributory retirement pension","es":"Pension no contributiva de jubilacion","de":"Nicht beitragsgebundene Altersrente","fr":"Pension de retraite non contributive","it":"Pensione di vecchiaia non contributiva","pt":"Pensao de velhice nao contributiva"}'::jsonb,
    '{"en":"Income-tested support for older residents who do not have enough contributions for a standard pension.","es":"Apoyo sujeto a ingresos para personas mayores sin cotizaciones suficientes para una pension ordinaria.","de":"Einkommensgepruefte Hilfe fuer aeltere Menschen ohne ausreichende Beitraege fuer eine regulaere Rente.","fr":"Aide sous condition de ressources pour les personnes agees sans cotisations suffisantes.","it":"Sostegno legato al reddito per anziani senza contributi sufficienti.","pt":"Apoio sujeito a rendimentos para idosos sem contribuicoes suficientes."}'::jsonb,
    '[{"field":"age","operator":"gte","value":65},{"field":"currentBenefits","operator":"notIncludes","value":"es-pnc"}]'::jsonb,
    false
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    'ES', null,
    '{"en":"Minimum Living Income","es":"Ingreso Minimo Vital","de":"Mindestsicherung in Spanien","fr":"Revenu minimum vital","it":"Reddito minimo vitale","pt":"Rendimento minimo vital"}'::jsonb,
    '{"en":"Household income support for people in a financially vulnerable situation.","es":"Apoyo a los ingresos del hogar para personas en situacion de vulnerabilidad economica.","de":"Einkommenshilfe fuer Haushalte in finanziell schwieriger Lage.","fr":"Aide au revenu des foyers en situation de vulnerabilite financiere.","it":"Sostegno al reddito per nuclei in difficolta economica.","pt":"Apoio ao rendimento para agregados em vulnerabilidade financeira."}'::jsonb,
    '[{"field":"age","operator":"gte","value":18},{"field":"currentBenefits","operator":"notIncludes","value":"es-imv"}]'::jsonb,
    false
  ),
  (
    '11000000-0000-4000-8000-000000000003',
    'DE', null,
    '{"en":"Basic income support in old age","es":"Ayuda basica de ingresos en la vejez","de":"Grundsicherung im Alter","fr":"Revenu de base pour les personnes agees","it":"Sostegno di base nella vecchiaia","pt":"Apoio basico ao rendimento na velhice"}'::jsonb,
    '{"en":"Income-tested support when retirement income is not enough for essential living costs.","es":"Apoyo sujeto a ingresos cuando la pension no cubre los gastos esenciales.","de":"Einkommensgepruefte Hilfe, wenn die Rente nicht fuer den notwendigen Lebensunterhalt reicht.","fr":"Aide sous condition de ressources lorsque la retraite ne couvre pas les besoins essentiels.","it":"Sostegno legato al reddito quando la pensione non copre le spese essenziali.","pt":"Apoio sujeito a rendimentos quando a reforma nao cobre despesas essenciais."}'::jsonb,
    '[{"field":"age","operator":"gte","value":65},{"field":"currentBenefits","operator":"notIncludes","value":"de-grundsicherung"}]'::jsonb,
    false
  ),
  (
    '11000000-0000-4000-8000-000000000004',
    'DE', null,
    '{"en":"Housing benefit","es":"Ayuda para la vivienda","de":"Wohngeld","fr":"Allocation logement","it":"Sussidio per l alloggio","pt":"Subsidio de habitacao"}'::jsonb,
    '{"en":"Help with rent or housing costs for households on a limited income.","es":"Ayuda con el alquiler o los costes de vivienda para hogares con ingresos limitados.","de":"Zuschuss zu Miete oder Wohnkosten fuer Haushalte mit begrenztem Einkommen.","fr":"Aide au loyer ou aux frais de logement pour les foyers a revenu modeste.","it":"Aiuto per affitto o costi abitativi per famiglie a reddito limitato.","pt":"Ajuda com renda ou custos de habitacao para agregados com rendimento limitado."}'::jsonb,
    '[{"field":"age","operator":"gte","value":18},{"field":"currentBenefits","operator":"notIncludes","value":"de-wohngeld"}]'::jsonb,
    false
  )
on conflict (id) do nothing;
