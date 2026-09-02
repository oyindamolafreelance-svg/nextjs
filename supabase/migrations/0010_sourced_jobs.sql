-- Wave B: automatic job sourcing. Auto-found jobs arrive as `pending` with
-- their source + apply link, and an admin approves them onto the board.
-- Safe to run on an existing database.

alter table public.jobs
  add column if not exists source_url     text,
  add column if not exists source_name    text,
  add column if not exists external_id    text,
  add column if not exists review_status  text not null default 'approved';

-- Prevent ingesting the same external posting twice.
create unique index if not exists jobs_source_dedup_idx
  on public.jobs (source_name, external_id)
  where source_name is not null and external_id is not null;

create index if not exists jobs_review_status_idx on public.jobs (review_status);

-- Members see only APPROVED listings (plus their own posts); admins see all.
-- Pending sourced jobs are reviewed on the admin page, not shown on the board.
drop policy if exists "jobs_select_visible" on public.jobs;
create policy "jobs_select_visible"
  on public.jobs for select
  using (
    public.is_admin()
    or (
      public.is_approved_member()
      and (
        posted_by = auth.uid()
        or (review_status = 'approved' and public.can_view_board())
      )
    )
  );
