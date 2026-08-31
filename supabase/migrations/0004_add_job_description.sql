-- Add a rich, free-text description to job listings — a well-structured
-- outline of the role so members can write a targeted application without
-- missing any detail. Nullable; existing rows keep NULL.
--
-- Safe to run on an existing database.

alter table public.jobs
  add column if not exists description text;
