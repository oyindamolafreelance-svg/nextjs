import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractJobFields } from "@/lib/ai/extract-job";

// Receives a clipped job from the browser extension. Authenticated by the
// caller's personal clip token (not a session cookie). The clip lands as a
// PENDING sourced lead credited to the clipper, for admin review.
//
// CORS: the extension calls this from any origin, so allow it.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-clip-token",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const token = request.headers.get("x-clip-token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing clip token." }, { status: 401, headers: CORS });
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_approved")
    .eq("clip_token", token)
    .maybeSingle();

  if (!profile || !profile.is_approved) {
    return NextResponse.json({ error: "Invalid clip token." }, { status: 403, headers: CORS });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const text = typeof body?.text === "string" ? body.text : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const sourceName = typeof body?.source === "string" && body.source ? body.source : "Clip";

  if (!title && !text) {
    return NextResponse.json({ error: "Nothing to clip." }, { status: 400, headers: CORS });
  }

  // Reuse the offline extractor to structure the pasted page text.
  const fields = extractJobFields(`${title}\n${text}`);
  const applyContact = (fields.apply_contact || url).trim();
  if (!applyContact) {
    return NextResponse.json(
      { error: "Couldn't find an apply email/link on the page." },
      { status: 422, headers: CORS }
    );
  }

  const now = new Date();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      title: (fields.title || title || "Clipped job").slice(0, 300),
      language_pair: fields.language_pair || "See posting",
      domain: fields.domain || "general",
      work_type: fields.work_type || "translation",
      experience_required: fields.experience_required || null,
      apply_contact: applyContact.slice(0, 500),
      description: fields.description || null,
      application_instructions: fields.application_instructions || null,
      source: sourceName,
      source_url: url || null,
      source_name: sourceName,
      review_status: "pending",
      posted_by: profile.id,
      is_active: true,
      date_posted: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  }
  return NextResponse.json({ ok: true, id: data?.id }, { headers: CORS });
}
