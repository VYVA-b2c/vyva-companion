create extension if not exists pgcrypto;

create table if not exists hero_messages (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  surface text not null,
  reason text not null default 'evergreen',
  priority integer not null default 10,
  cooldown_hours integer not null default 8,
  periods text[] not null default '{}'::text[],
  safety_levels text[] not null default '{}'::text[],
  event_types text[] not null default '{}'::text[],
  activity_types text[] not null default '{}'::text[],
  copy jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hero_messages_message_id_idx on hero_messages(message_id);
create index if not exists hero_messages_surface_idx on hero_messages(surface);
create index if not exists hero_messages_enabled_idx on hero_messages(is_enabled);
