import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { parseJobText, ParseJobError } from "@/lib/ai/parse-job";

// Approved members only: parse pasted job text into structured fields for the
// post-job form. Auth is checked here (not just in the UI).
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.profile.is_approved) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rawText = body?.text;
  if (typeof rawText !== "string") {
    return NextResponse.json({ error: "Missing job text." }, { status: 400 });
  }

  try {
    const { fields, source } = await parseJobText(rawText);
    return NextResponse.json({ fields, source });
  } catch (err) {
    const message =
      err instanceof ParseJobError ? err.message : "Auto-fill failed. Please try again.";
    const status = err instanceof ParseJobError ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
