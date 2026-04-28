create table if not exists specialist_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null,
  base_url text not null,
  country text not null default 'ES',
  region text,
  trust_tier integer not null default 2,
  search_method text not null default 'web',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists specialist_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null,
  conditions_supported text[] not null default '{}',
  clinic_name text,
  phone text,
  booking_url text,
  address text,
  city text,
  postcode text,
  latitude numeric,
  longitude numeric,
  languages text[] not null default '{}',
  insurance_accepted text[] not null default '{}',
  review_score numeric,
  review_count integer,
  availability_text text,
  source_url text,
  source_name text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists specialist_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  condition_text text not null,
  matched_specialties text[] not null default '{}',
  provider_ids uuid[] not null default '{}',
  rationale jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_specialist_providers_specialty
  on specialist_providers (specialty);

create index if not exists idx_specialist_providers_city
  on specialist_providers (city);
