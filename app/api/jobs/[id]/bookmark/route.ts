import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Toggle a bookmark on a listing. Returns the new saved state.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user?.profile.is_approved) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("job_bookmarks")
    .select("id")
    .eq("job_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("job_bookmarks").delete().eq("id", existing.id);
    return NextResponse.json({ saved: false });
  }

  const { error } = await supabase
    .from("job_bookmarks")
    .insert({ job_id: id, user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ saved: true });
}
