-- Row Level Security for the job board.
-- Depends on 0001_initial_schema.sql (tables + is_admin()/is_approved_member()).

-- ---------------------------------------------------------------------------
-- profiles
--   * A user may read and update ONLY their own row.
--   * Admins may read and update EVERY row (for the approval workflow).
--   * INSERT happens through the on_auth_user_created trigger, so no INSERT
--     policy is granted to clients.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- jobs
--   * SELECT allowed only for approved members (and admins, who are members).
--   * INSERT / UPDATE / DELETE allowed only for admins.
-- ---------------------------------------------------------------------------
alter table public.jobs enable row level security;

drop policy if exists "jobs_select_approved" on public.jobs;
create policy "jobs_select_approved"
  on public.jobs for select
  using (public.is_approved_member());

drop policy if exists "jobs_insert_admin" on public.jobs;
create policy "jobs_insert_admin"
  on public.jobs for insert
  with check (public.is_admin());

drop policy if exists "jobs_update_admin" on public.jobs;
create policy "jobs_update_admin"
  on public.jobs for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "jobs_delete_admin" on public.jobs;
create policy "jobs_delete_admin"
  on public.jobs for delete
  using (public.is_admin());
