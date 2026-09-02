-- Open the board: every approved member can view all listings (the daily
-- give-to-get gate is turned off for viewing). Tiers and the leaderboard stay
-- as status/badges. Admins and exempt members were already unrestricted.
--
-- To RE-ENABLE the give-to-get gate later, redefine can_view_board() back to
-- the tier-quota version from 0008 (and flip OPEN_BOARD to false in the app).
--
-- Safe to run on an existing database.

create or replace function public.can_view_board()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin() or public.is_approved_member();
$$;
