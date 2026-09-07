-- Re-enable the give-to-get gate: members must meet their (tier-based) daily
-- post quota before they can browse other members' / sourced jobs. Their own
-- posts stay visible; admins and exempt members bypass. Restores the tier
-- version of can_view_board() from 0008 (0009 had opened it).
-- Safe to run on an existing database.

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
      and (
        public.is_exempt_member()
        or public.daily_post_count() >= public.user_daily_quota(auth.uid())
      )
    );
$$;
