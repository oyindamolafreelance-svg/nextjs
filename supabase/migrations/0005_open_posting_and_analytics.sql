-- Open posting + daily give-to-get + click analytics.
--
-- Model change: any APPROVED member can post jobs (not just admins). To browse
-- OTHER members' jobs on a given day, a member must have posted N jobs that day
-- (the "give-to-get" gate; admins are exempt and always see everything). Admins
-- can see who clicked "apply" on each job.
--
-- Safe to run on an existing database.

-- ---------------------------------------------------------------------------
-- jobs.posted_by: who created the listing (defaults to the caller).
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists posted_by uuid references auth.users (id) on delete set null default auth.uid();

create index if not exists jobs_posted_by_idx on public.jobs (posted_by, date_posted);

-- ---------------------------------------------------------------------------
-- Daily give-to-get threshold. Change this one number to tune the gate
-- (e.g. lower it to 2 if signups stall). Admins bypass it entirely.
-- ---------------------------------------------------------------------------
create or replace function public.daily_post_quota()
returns integer language sql immutable as $$ select 5 $$;

-- How many jobs the current user has posted since midnight (server/UTC day).
create or replace function public.daily_post_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from public.jobs
  where posted_by = auth.uid()
    and date_posted >= date_trunc('day', now());
$$;

-- May the current user browse the whole board today?
create or replace function public.can_view_board()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or (public.is_approved_member() and public.daily_post_count() >= public.daily_post_quota());
$$;

-- ---------------------------------------------------------------------------
-- jobs RLS: approved members may INSERT their own listings; SELECT is gated by
-- the give-to-get rule (but you can always see your own posts). UPDATE/DELETE
-- stay admin-only.
-- ---------------------------------------------------------------------------
drop policy if exists "jobs_insert_admin" on public.jobs;
drop policy if exists "jobs_insert_approved" on public.jobs;
create policy "jobs_insert_approved"
  on public.jobs for insert
  with check (public.is_approved_member() and posted_by = auth.uid());

drop policy if exists "jobs_select_approved" on public.jobs;
drop policy if exists "jobs_select_visible" on public.jobs;
create policy "jobs_select_visible"
  on public.jobs for select
  using (
    public.is_admin()
    or (
      public.is_approved_member()
      and (posted_by = auth.uid() or public.can_view_board())
    )
  );

-- ---------------------------------------------------------------------------
-- job_views: one row per "apply" click. Approved members log their own clicks;
-- only admins can read them.
-- ---------------------------------------------------------------------------
create table if not exists public.job_views (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs (id) on delete cascade,
  viewer_id  uuid not null references auth.users (id) on delete cascade,
  kind       text not null default 'click',
  created_at timestamptz not null default now()
);

create index if not exists job_views_job_idx on public.job_views (job_id);
create index if not exists job_views_viewer_idx on public.job_views (viewer_id);

alter table public.job_views enable row level security;

drop policy if exists "job_views_insert_approved" on public.job_views;
create policy "job_views_insert_approved"
  on public.job_views for insert
  with check (public.is_approved_member() and viewer_id = auth.uid());

drop policy if exists "job_views_select_admin" on public.job_views;
create policy "job_views_select_admin"
  on public.job_views for select
  using (public.is_admin());
