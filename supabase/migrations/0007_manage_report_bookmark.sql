-- Wave 1: owner post management, reporting, bookmarks, and poster analytics.
-- All additive. Safe to run on an existing database.

-- ---------------------------------------------------------------------------
-- Owners can update / delete their OWN listings (admins already can do all).
-- ---------------------------------------------------------------------------
drop policy if exists "jobs_update_own" on public.jobs;
create policy "jobs_update_own"
  on public.jobs for update
  using (posted_by = auth.uid())
  with check (posted_by = auth.uid());

drop policy if exists "jobs_delete_own" on public.jobs;
create policy "jobs_delete_own"
  on public.jobs for delete
  using (posted_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Reports / flags. Approved members file their own; admins read them.
-- ---------------------------------------------------------------------------
create table if not exists public.job_reports (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists job_reports_job_idx on public.job_reports (job_id);

alter table public.job_reports enable row level security;

drop policy if exists "job_reports_insert_approved" on public.job_reports;
create policy "job_reports_insert_approved"
  on public.job_reports for insert
  with check (public.is_approved_member() and reporter_id = auth.uid());

drop policy if exists "job_reports_select_admin" on public.job_reports;
create policy "job_reports_select_admin"
  on public.job_reports for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Bookmarks. Each user fully manages their own rows.
-- ---------------------------------------------------------------------------
create table if not exists public.job_bookmarks (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (job_id, user_id)
);
create index if not exists job_bookmarks_user_idx on public.job_bookmarks (user_id);

alter table public.job_bookmarks enable row level security;

drop policy if exists "job_bookmarks_all_own" on public.job_bookmarks;
create policy "job_bookmarks_all_own"
  on public.job_bookmarks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Let a poster see the apply-clicks on their OWN listings (admins see all).
-- ---------------------------------------------------------------------------
drop policy if exists "job_views_select_owner" on public.job_views;
create policy "job_views_select_owner"
  on public.job_views for select
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_views.job_id and j.posted_by = auth.uid()
    )
  );
