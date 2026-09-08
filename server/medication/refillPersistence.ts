import { pool } from "../db.js";

let persistencePromise: Promise<void> | null = null;

export async function ensureRefillPersistence() {
  if (!persistencePromise) {
    persistencePromise = pool.query(`
      alter table if exists my_medicines
        add column if not exists dose_unit text,
        add column if not exists units_per_dose numeric(10,2),
        add column if not exists inventory_unit text,
        add column if not exists inventory_units_per_dose numeric(10,2),
        add column if not exists daily_frequency numeric(6,2),
        add column if not exists inventory_tracking_enabled boolean not null default false,
        add column if not exists refill_alert_days integer not null default 7;

      update my_medicines
      set
        inventory_unit = coalesce(inventory_unit, dose_unit),
        inventory_units_per_dose = coalesce(inventory_units_per_dose, units_per_dose)
      where inventory_tracking_enabled = true
        and (inventory_unit is null or inventory_units_per_dose is null);

      alter table if exists user_channel_preferences
        add column if not exists medication_refill_push_enabled boolean not null default false;

      create table if not exists medication_inventory_events (
        id uuid primary key default gen_random_uuid(),
        user_id text not null,
        medicine_id uuid not null references my_medicines(id) on delete cascade,
        event_type text not null,
        quantity numeric(12,2) not null,
        unit text not null,
        occurred_on date not null,
        source text not null default 'manual',
        actor_user_id text not null,
        actor_role text not null default 'user',
        actor_name text,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      create index if not exists medication_inventory_events_user_medicine_date_idx
        on medication_inventory_events (user_id, medicine_id, occurred_on desc);

      create table if not exists medication_refill_alerts (
        id uuid primary key default gen_random_uuid(),
        user_id text not null,
        medicine_id uuid not null references my_medicines(id) on delete cascade,
        status text not null,
        cycle_key text not null,
        title text not null,
        message text not null,
        days_remaining integer,
        projected_run_out_date date,
        created_at timestamptz not null default now(),
        resolved_at timestamptz,
        resolved_reason text
      );

      create unique index if not exists medication_refill_alerts_cycle_status_unique
        on medication_refill_alerts (user_id, medicine_id, cycle_key, status);
      create index if not exists medication_refill_alerts_user_open_idx
        on medication_refill_alerts (user_id, resolved_at, created_at desc);

      create table if not exists medication_refill_push_deliveries (
        id uuid primary key default gen_random_uuid(),
        delivery_key text not null unique,
        alert_id uuid not null references medication_refill_alerts(id) on delete cascade,
        profile_id text not null,
        medicine_id uuid not null references my_medicines(id) on delete cascade,
        cycle_key text not null,
        recipient_user_id text not null,
        recipient_role text not null,
        subscription_id uuid not null,
        status text not null default 'sending',
        provider_status integer,
        failure_reason text,
        requested_at timestamptz not null default now(),
        sent_at timestamptz,
        failed_at timestamptz,
        opened_at timestamptz,
        resolved_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint medication_refill_push_deliveries_status_chk
          check (status in ('sending', 'sent', 'failed_retryable', 'failed_permanent')),
        constraint medication_refill_push_deliveries_role_chk
          check (recipient_role in ('elder', 'caregiver', 'family'))
      );

      create index if not exists medication_refill_push_deliveries_recipient_idx
        on medication_refill_push_deliveries (recipient_user_id, created_at desc);
      create index if not exists medication_refill_push_deliveries_alert_idx
        on medication_refill_push_deliveries (alert_id);
    `).then(() => undefined).catch((error) => {
      persistencePromise = null;
      throw error;
    });
  }
  return persistencePromise;
}
