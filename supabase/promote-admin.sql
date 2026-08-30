-- One-time: promote the site owner to admin (and approve them).
-- Register through the app first so the auth user + profile row exist,
-- then run this in the Supabase SQL editor with the owner's email.

update public.profiles
set is_admin = true,
    is_approved = true
where email = 'owner@example.com';
