alter table if exists triage_reports
  add column if not exists interpretation text,
  add column if not exists possible_patterns jsonb not null default '[]'::jsonb,
  add column if not exists uncertainty text[] not null default '{}',
  add column if not exists reassessment_window text,
  add column if not exists change_plan_triggers text[] not null default '{}',
  add column if not exists clinical_handoff jsonb;
