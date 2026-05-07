alter table public.profiles
  alter column subscription_tier set default 'free';

alter table public.organizations
  alter column default_tier set default 'free';

alter table public.user_intakes
  alter column tier set default 'free';

alter table public.access_links
  alter column tier set default 'free';

update public.profiles
set subscription_tier = case
  when subscription_tier in ('trial', 'free') then 'free'
  when subscription_tier in ('essential', 'unlimited', 'premium') then 'premium'
  else subscription_tier
end
where subscription_tier in ('trial', 'free', 'essential', 'unlimited', 'premium');

update public.organizations
set default_tier = case
  when default_tier in ('trial', 'free') then 'free'
  when default_tier in ('essential', 'unlimited', 'premium') then 'premium'
  else default_tier
end
where default_tier in ('trial', 'free', 'essential', 'unlimited', 'premium');

update public.user_intakes
set tier = case
  when tier in ('trial', 'free') then 'free'
  when tier in ('essential', 'unlimited', 'premium') then 'premium'
  else tier
end
where tier in ('trial', 'free', 'essential', 'unlimited', 'premium');

update public.access_links
set tier = case
  when tier in ('trial', 'free') then 'free'
  when tier in ('essential', 'unlimited', 'premium') then 'premium'
  else tier
end
where tier in ('trial', 'free', 'essential', 'unlimited', 'premium');

insert into public.subscription_plans (
  plan_id, name, description, price_eur, price_gbp, billing_interval, trial_days,
  features, is_active, is_public, sort_order
) values
  (
    'free',
    'Free',
    'Core features forever free',
    0,
    0,
    'month',
    7,
    array['companionship', 'brain_training', 'daily_checkin'],
    true,
    true,
    0
  ),
  (
    'premium',
    'Premium',
    'Full VYVA experience',
    2900,
    2499,
    'month',
    14,
    array[
      'companionship',
      'brain_training',
      'daily_checkin',
      'medication_mgmt',
      'vital_scan',
      'health_research',
      'nutrition_coach',
      'safety_agent',
      'fall_detection',
      'concierge',
      'caregiver_alerts',
      'device_triage',
      'personalised_convos'
    ],
    true,
    true,
    1
  )
on conflict (plan_id) do nothing;

update public.subscription_plans
set is_active = false,
    is_public = false,
    updated_at = now()
where plan_id in ('trial', 'essential', 'unlimited', 'custom');

insert into public.tier_entitlements (
  tier, display_name, description, voice_assistant, medication_tracking,
  symptom_check, concierge, caregiver_dashboard, custom_features, is_active
) values
  (
    'free',
    'Free',
    'Core VYVA companion features.',
    true,
    true,
    false,
    false,
    false,
    '{}'::jsonb,
    true
  ),
  (
    'premium',
    'Premium',
    'Full VYVA support bundle.',
    true,
    true,
    true,
    true,
    true,
    '{}'::jsonb,
    true
  )
on conflict (tier) do nothing;
