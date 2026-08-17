-- Translation & Localization Job Board — initial schema
-- Run order: this file first, then 0002_rls_policies.sql.
--
-- Apply with the Supabase CLI (`supabase db push`) or by pasting into the
-- Supabase SQL editor. Keep these files as the source of truth — do not make
-- untracked schema changes in the dashboard.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users user, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  is_approved boolean not null default false,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile linked 1:1 to auth.users. Gates access to the job board.';

-- ---------------------------------------------------------------------------
-- jobs: curated listings entered by the admin.
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id                       uuid primary key default gen_random_uuid(),
  title                    text not null,
  language_pair            text not null,
  domain                   text not null,
  work_type                text not null,
  experience_required      text,
  apply_contact            text not null,
  application_instructions text,
  source                   text,
  date_posted              timestamptz not null default now(),
  expires_at               timestamptz,
  is_active                boolean not null default true
);

comment on table public.jobs is
  'Curated translation/localization job listings. Visible to approved members only.';

-- Newest-first browsing, and fast filtering of the active board.
create index if not exists jobs_date_posted_idx on public.jobs (date_posted desc);
create index if not exists jobs_active_idx on public.jobs (is_active, expires_at);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up.
-- SECURITY DEFINER so it can insert regardless of the caller's RLS context.
-- full_name is read from the sign-up metadata when provided.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helper used by RLS policies: is the current user an approved member?
-- SECURITY DEFINER + a dedicated function avoids recursive RLS evaluation
-- when a policy on `jobs` needs to read `profiles`.
-- ---------------------------------------------------------------------------
create or replace function public.is_approved_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_approved = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- ---------------------------------------------------------------------------
-- Privilege guard: the profiles RLS UPDATE policy lets a user edit their own
-- row (e.g. their name), but RLS can't restrict *which* columns. Without this
-- a pending user could set their own is_approved / is_admin to true. This
-- trigger pins those two columns to their previous values for anyone who is
-- not an admin, so only the admin approval flow can flip them.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.is_approved := old.is_approved;
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();
