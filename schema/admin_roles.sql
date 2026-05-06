alter table public.profiles
  add column if not exists role text not null default 'user';

create index if not exists profiles_role_idx on public.profiles(role);

-- Replace this email with the account that should become the first admin.
insert into public.profiles (id, email, role)
select u.id, u.email, 'admin'
from auth.users u
where lower(u.email) = lower('YOUR_ADMIN_EMAIL@example.com')
on conflict (id) do update
set
  role = 'admin',
  email = coalesce(public.profiles.email, excluded.email),
  updated_at = now();

select p.id, coalesce(p.email, u.email) as email, p.role
from public.profiles p
left join auth.users u on p.id = u.id
where lower(coalesce(p.email, u.email)) = lower('YOUR_ADMIN_EMAIL@example.com');
