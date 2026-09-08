insert into advisor_agents (slug, icon_key, chip_bg, icon_color, sort_order, is_enabled)
values ('ines', 'benefits', '#EAF3EE', '#0A6B4A', 55, true)
on conflict (slug) do nothing;
