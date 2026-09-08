import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { translateSegments, TranslateError } from "@/lib/ai/translate";

// Approved members only: translate ONE chunk of segments. The browser chunks a
// document and calls this repeatedly, so each serverless invocation stays well
// under Vercel's function timeout (the queue-and-poll principle applied to a
// stateless endpoint). A coarse per-request cap prevents oversized chunks.
const MAX_SEGMENTS = 80;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.profile.is_approved) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const segments = body?.segments;
  const targetLang = body?.targetLang;
  if (!Array.isArray(segments) || segments.some((s) => typeof s !== "string")) {
    return NextResponse.json({ error: "Invalid segments." }, { status: 400 });
  }
  if (typeof targetLang !== "string" || !targetLang.trim()) {
    return NextResponse.json({ error: "Missing target language." }, { status: 400 });
  }
  if (segments.length > MAX_SEGMENTS) {
    return NextResponse.json(
      { error: `Too many segments in one request (max ${MAX_SEGMENTS}).` },
      { status: 400 }
    );
  }

  try {
    const translations = await translateSegments(segments as string[], {
      sourceLang: typeof body?.sourceLang === "string" ? body.sourceLang : "auto",
      targetLang,
      domain: typeof body?.domain === "string" ? body.domain : "general",
    });
    return NextResponse.json({ translations });
  } catch (err) {
    const message =
      err instanceof TranslateError ? err.message : "Translation failed. Please try again.";
    const status = err instanceof TranslateError ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
