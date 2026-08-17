import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface SessionUser {
  id: string;
  email: string;
  profile: Profile;
}

// Data Access Layer entry point. Verifies the session against Supabase
// (getUser hits the auth server, unlike getSession) and loads the profile.
// Returns null when signed out. Cached per-request so layouts and pages can
// each call it without extra round-trips.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { id: user.id, email: user.email ?? profile.email, profile };
});

// Require any signed-in user; bounce to /login otherwise.
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

// Require an approved member. Signed-in-but-pending users go to /pending.
export async function requireApproved(next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!user.profile.is_approved) {
    redirect("/pending");
  }
  return user;
}

// Require an admin. Non-admins are treated as not-found for the admin area.
export async function requireAdmin(next?: string): Promise<SessionUser> {
  const user = await requireApproved(next);
  if (!user.profile.is_admin) {
    redirect("/jobs");
  }
  return user;
}
