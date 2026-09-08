update public.longevity_daily_content
set title = 'Find a nearby walk or activity',
    description = 'After lunch, VYVA can suggest nearby places, gentle groups, or daytime programs.',
    detail_text = 'Look for an easy place to pause, sit, or go with someone if that feels better.',
    source_label = 'Nearby walking ideas',
    source_url = '/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning'
where language = 'en'
  and title = 'Walk after lunch';

update public.longevity_daily_content
set description = 'A short outing gives the heart step a clear place and time.',
    detail_text = 'VYVA can help look for a close, calm option before you decide.',
    source_label = 'Nearby walking ideas',
    source_url = '/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning'
where language = 'en'
  and title = 'Step outside for five minutes';

update public.longevity_daily_content
set source_label = 'Nearby walking ideas',
    source_url = '/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning'
where language = 'en'
  and title = 'Put walking shoes by the door';
