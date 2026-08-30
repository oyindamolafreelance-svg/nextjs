-- Fix: the privilege-guard trigger from 0001 also blocked legitimate
-- privilege changes made from trusted backend contexts (the Supabase SQL
-- editor, the service-role key, migrations), because those have no auth user
-- (auth.uid() is null → is_admin() is false). That made promote-admin.sql
-- silently no-op — the first admin could never be seeded.
--
-- The `auth.uid() is not null` guard restricts the lock to a logged-in
-- non-admin *user* (the actual escalation risk), while leaving trusted
-- backend/SQL access — which already bypasses RLS — free to set the columns.
--
-- Safe to run on an existing database; it only replaces the function body.

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.is_approved := old.is_approved;
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;
