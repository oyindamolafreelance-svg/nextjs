import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// File a report/flag on a listing. Approved members only.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user?.profile.is_approved) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const reason =
    typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_reports")
    .insert({ job_id: id, reporter_id: user.id, reason });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
