-- Contribution tiers. A tier is earned by meeting ALL THREE of: lifetime
-- distinct posts, active days (days on which the user hit the daily quota),
-- and apply-clicks their posts earned. Higher tiers lower the daily unlock
-- quota, and the top tier gets permanent browse access. Anti-gaming: the
-- active-days and clicks-earned requirements mean spam alone can't lift a tier.
--
-- Timezone for "active day" bucketing (keep in step with NEXT_PUBLIC_SITE_TZ).
-- Safe to run on an existing database.

create or replace function public.user_post_count(uid uuid)
returns integer language sql security definer set search_path = public stable as $$
  select count(*)::int from public.jobs where posted_by = uid;
$$;

create or replace function public.user_active_days(uid uuid)
returns integer language sql security definer set search_path = public stable as $$
  select count(*)::int from (
    select 1
    from public.jobs
    where posted_by = uid
    group by (date_posted at time zone 'Africa/Lagos')::date
    having count(*) >= 5
  ) d;
$$;

create or replace function public.user_clicks_earned(uid uuid)
returns integer language sql security definer set search_path = public stable as $$
  select count(*)::int
  from public.job_views v
  join public.jobs j on j.id = v.job_id
  where j.posted_by = uid;
$$;

create or replace function public.user_tier(uid uuid)
returns text language sql security definer set search_path = public stable as $$
  select case
    when p >= 750 and d >= 150 and c >= 300 then 'Ambassador'
    when p >= 300 and d >= 60  and c >= 120 then 'Veteran'
    when p >= 100 and d >= 20  and c >= 40  then 'Trusted'
    when p >= 25  and d >= 5   and c >= 10  then 'Contributor'
    else 'Newcomer'
  end
  from (
    select public.user_post_count(uid) as p,
           public.user_active_days(uid) as d,
           public.user_clicks_earned(uid) as c
  ) x;
$$;

create or replace function public.user_daily_quota(uid uuid)
returns integer language sql security definer set search_path = public stable as $$
  select case public.user_tier(uid)
    when 'Ambassador' then 0
    when 'Veteran' then 2
    when 'Trusted' then 3
    when 'Contributor' then 4
    else 5
  end;
$$;

-- No-arg helpers the app calls via RPC (always scoped to the caller).
create or replace function public.my_daily_quota()
returns integer language sql security definer set search_path = public stable as $$
  select public.user_daily_quota(auth.uid());
$$;

create or replace function public.my_progress()
returns table(posts int, active_days int, clicks int, tier text, quota int)
language sql security definer set search_path = public stable as $$
  select public.user_post_count(auth.uid()),
         public.user_active_days(auth.uid()),
         public.user_clicks_earned(auth.uid()),
         public.user_tier(auth.uid()),
         public.user_daily_quota(auth.uid());
$$;

-- Public-to-members leaderboard. Names only (no emails); bypasses the board
-- RLS so members can see top contributors.
create or replace function public.leaderboard()
returns table(display text, posts int, tier text)
language sql security definer set search_path = public stable as $$
  select coalesce(nullif(p.full_name, ''), 'Member ' || left(p.id::text, 4)) as display,
         public.user_post_count(p.id) as posts,
         public.user_tier(p.id) as tier
  from public.profiles p
  where public.user_post_count(p.id) > 0
  order by public.user_post_count(p.id) desc
  limit 20;
$$;

-- The daily give-to-get gate now uses the tier-based quota (Ambassador = 0,
-- i.e. permanent access; admins and exempt members still bypass entirely).
create or replace function public.can_view_board()
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_admin()
    or (
      public.is_approved_member()
      and (
        public.is_exempt_member()
        or public.daily_post_count() >= public.user_daily_quota(auth.uid())
      )
    );
$$;
