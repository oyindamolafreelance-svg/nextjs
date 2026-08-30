import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Scheduled daily by vercel.json. Flips is_active → false for any listing
// whose expires_at has passed. The /jobs board already hides expired listings
// at query time; this keeps the stored state tidy and dashboard counts honest.
//
// Runs with the service-role key (no user session), so it's guarded by a shared
// CRON_SECRET that Vercel Cron sends as a Bearer token.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("jobs")
    .update({ is_active: false })
    .eq("is_active", true)
    .lt("expires_at", nowIso)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expired: data?.length ?? 0 });
}
