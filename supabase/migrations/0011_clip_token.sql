-- Wave C: personal "clip token" so the browser extension can send jobs to the
-- board on a member's behalf (no cookies needed cross-site). Each approved
-- member generates their own token in Settings.
-- Safe to run on an existing database.

alter table public.profiles
  add column if not exists clip_token text;

create unique index if not exists profiles_clip_token_idx
  on public.profiles (clip_token)
  where clip_token is not null;
