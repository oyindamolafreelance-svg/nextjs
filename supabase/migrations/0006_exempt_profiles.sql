-- "Direct access" profiles: exempt from the daily give-to-get quota. An exempt
-- member can browse the whole board without posting (they may still post if
-- they want). Grant it per user with:
--   update public.profiles set is_exempt = true where email = 'them@example.com';
--
-- Safe to run on an existing database.

alter table public.profiles
  add column if not exists is_exempt boolean not null default false;

create or replace function public.is_exempt_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_exempt = true
  );
$$;

-- Exempt members bypass the quota (admins still bypass everything).
create or replace function public.can_view_board()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or (
      public.is_approved_member()
      and (public.is_exempt_member() or public.daily_post_count() >= public.daily_post_quota())
    );
$$;
