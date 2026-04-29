create table if not exists utility_review_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  country text not null default 'ES',
  utility_type text not null,
  input_method text not null,
  extracted_data_json jsonb not null default '{}'::jsonb,
  normalized_input_json jsonb not null default '{}'::jsonb,
  source_used text not null default 'CNMC',
  source_status text not null default 'pending',
  results_json jsonb not null default '[]'::jsonb,
  confidence text not null default 'medium',
  created_at timestamptz not null default now()
);

create index if not exists utility_review_runs_user_created_idx
  on utility_review_runs (user_id, created_at desc);
