alter table if exists public.longevity_video_resources
  add column if not exists pillar text,
  add column if not exists transcript_summary text,
  add column if not exists after_watch_action text,
  add column if not exists good_for text[] not null default array[]::text[],
  add column if not exists not_for text[] not null default array[]::text[],
  add column if not exists moment_fit text[] not null default array[]::text[];

do $$
begin
  if to_regclass('public.longevity_video_resources') is not null then
    update public.longevity_video_resources
    set good_for = coalesce(good_for, array[]::text[]),
        not_for = coalesce(not_for, array[]::text[]),
        moment_fit = coalesce(moment_fit, array[]::text[]),
        transcript_summary = coalesce(transcript_summary, summary),
        after_watch_action = coalesce(after_watch_action, senior_takeaway, summary)
    where good_for is null
       or not_for is null
       or moment_fit is null
       or transcript_summary is null
       or after_watch_action is null;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'longevity_video_resources_pillar_check'
    ) then
      alter table public.longevity_video_resources
        add constraint longevity_video_resources_pillar_check
        check (pillar is null or pillar in ('heart','brain','strength','nourishment','calm'));
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'longevity_video_resources_moment_fit_check'
    ) then
      alter table public.longevity_video_resources
        add constraint longevity_video_resources_moment_fit_check
        check (moment_fit <@ array['morning','midday','afternoon','evening']::text[]);
    end if;

    create index if not exists idx_longevity_video_resources_user_pillar
      on public.longevity_video_resources (user_id, pillar, created_at desc);

    comment on column public.longevity_video_resources.pillar is
      'Longevity pillar that the reviewed or cached video supports.';
    comment on column public.longevity_video_resources.transcript_summary is
      'Public-facing summary of the video transcript or manually reviewed content.';
    comment on column public.longevity_video_resources.after_watch_action is
      'One practical action to offer after the user opens the video.';
    comment on column public.longevity_video_resources.good_for is
      'Public fit notes describing when this resource is useful.';
    comment on column public.longevity_video_resources.not_for is
      'Public comfort notes describing when to choose a gentler alternative.';
    comment on column public.longevity_video_resources.moment_fit is
      'Day-part moments where this resource is most useful.';
  end if;

  if to_regclass('public.longevity_action_events') is not null then
    alter table public.longevity_action_events
      drop constraint if exists lae_event_type_check;

    alter table public.longevity_action_events
      add constraint lae_event_type_check
      check (event_type in ('shown','opened','saved','done','too_hard','not_relevant'));
  end if;
end $$;
