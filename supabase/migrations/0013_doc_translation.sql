-- DocTranslate Phase 0: document-translation job history + daily quota.
-- Office files (Phase 1) are processed entirely in the browser, so the file
-- itself is NOT uploaded here — we only record a lightweight job row per
-- document for history and to enforce a per-user daily ceiling (the abuse /
-- free-tier cost guard). Storage of files arrives with the PDF/OCR phases.
-- Safe to run on an existing database.

create table if not exists public.doc_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  filename     text not null,
  kind         text not null,               -- docx | pptx | xlsx | pdf | image
  source_lang  text,
  target_lang  text not null,
  domain       text,
  page_count   integer not null default 1,
  status       text not null default 'processing', -- processing | complete | error
  created_at   timestamptz not null default now()
);

create index if not exists doc_jobs_user_created_idx
  on public.doc_jobs (user_id, created_at desc);

alter table public.doc_jobs enable row level security;

-- Owners see and manage only their own jobs; admins can see all.
drop policy if exists "doc_jobs_select_own" on public.doc_jobs;
create policy "doc_jobs_select_own"
  on public.doc_jobs for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "doc_jobs_insert_own" on public.doc_jobs;
create policy "doc_jobs_insert_own"
  on public.doc_jobs for insert
  with check (user_id = auth.uid());

drop policy if exists "doc_jobs_update_own" on public.doc_jobs;
create policy "doc_jobs_update_own"
  on public.doc_jobs for update
  using (user_id = auth.uid());

-- How many documents the current user has started translating today (their
-- local-ish day in UTC). Used to enforce the daily ceiling.
create or replace function public.my_docs_today()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from public.doc_jobs
  where user_id = auth.uid()
    and created_at >= date_trunc('day', now());
$$;

-- Daily document allowance. Kept simple for now (a constant); can be made
-- tier-aware later like the job-board quota. Exempt members & admins are
-- treated as unlimited by the calling code.
create or replace function public.my_doc_allowance()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select case
    when public.is_admin() then 1000000
    when public.is_exempt_member() then 1000000
    else 15
  end;
$$;
