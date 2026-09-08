update public.longevity_daily_content as content
set source_label = resources.source_label,
    source_url = resources.source_url
from (
  values
    ('Find a nearby walk or activity', 'Nearby walking ideas', '/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning'),
    ('Walk after lunch', 'Nearby walking ideas', '/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning'),
    ('Step outside for five minutes', 'Nearby walking ideas', '/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning'),
    ('Put the BP cuff where you sit', 'AHA BP guide', 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home'),
    ('Save one heart question', 'AHA BP guide', 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home'),
    ('One familiar Brain Coach round', 'Brain Coach', '/mind'),
    ('Name three photos from yesterday', 'NIA brain guide', 'https://www.nia.nih.gov/health/brain-health/cognitive-health-and-older-adults'),
    ('Call someone you enjoy', 'NIA activities guide', 'https://www.nia.nih.gov/health/healthy-aging/participating-activities-you-enjoy-you-age'),
    ('Ten quiet minutes with a memory game', 'NIA brain guide', 'https://www.nia.nih.gov/health/brain-health/cognitive-health-and-older-adults'),
    ('Supported chair strength', 'NIA exercise videos', 'https://www.nia.nih.gov/toolkits/exercise'),
    ('Stand once during the next advert', 'NIA exercise videos', 'https://www.nia.nih.gov/toolkits/exercise'),
    ('Clear one walking path', 'NIA fall guide', 'https://www.nia.nih.gov/health/falls-and-falls-prevention/preventing-falls-home-room-room'),
    ('Put walking shoes by the door', 'Nearby walking ideas', '/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning'),
    ('Protein with the next meal', 'NIA food guide', 'https://www.nia.nih.gov/health/healthy-eating-nutrition-and-diet/healthy-eating-you-age-know-your-food-groups'),
    ('Protein at breakfast', 'NIA food guide', 'https://www.nia.nih.gov/health/healthy-eating-nutrition-and-diet/healthy-eating-you-age-know-your-food-groups'),
    ('Water where you sit', 'NIA meal planning', 'https://www.nia.nih.gov/health/healthy-eating-nutrition-and-diet/healthy-meal-planning-tips-older-adults'),
    ('Add one colour to the next plate', 'NIA food guide', 'https://www.nia.nih.gov/health/healthy-eating-nutrition-and-diet/healthy-eating-you-age-know-your-food-groups'),
    ('Place a snack beside your water', 'NIA meal planning', 'https://www.nia.nih.gov/health/healthy-eating-nutrition-and-diet/healthy-meal-planning-tips-older-adults'),
    ('Two-minute breathing reset', 'NIH relaxation guide', 'https://www.nccih.nih.gov/health/relaxation-techniques-what-you-need-to-know'),
    ('Same bedtime tonight', 'NIA sleep guide', 'https://www.nia.nih.gov/health/sleep/sleep-and-older-adults'),
    ('Choose tonight''s wind-down time', 'NIA sleep guide', 'https://www.nia.nih.gov/health/sleep/sleep-and-older-adults'),
    ('Ten minutes of morning light', 'NIA sleep guide', 'https://www.nia.nih.gov/health/sleep/sleep-and-older-adults'),
    ('One quiet pause after breakfast', 'NIH relaxation guide', 'https://www.nccih.nih.gov/health/relaxation-techniques-what-you-need-to-know')
) as resources(title, source_label, source_url)
where content.title = resources.title
  and content.language = 'en'
  and (
    content.source_label is distinct from resources.source_label
    or content.source_url is distinct from resources.source_url
  );
