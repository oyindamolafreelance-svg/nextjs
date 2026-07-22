import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateCaption } from "@/lib/ai/caption";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const profileId = body?.profileId;
  if (!profileId || typeof profileId !== "string") {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    const caption = await generateCaption({
      platform: profile.platform,
      niche: profile.niche,
      brandTone: profile.brandTone,
      brandHashtags: profile.brandHashtags,
      topic: typeof body.topic === "string" ? body.topic : undefined,
    });
    return NextResponse.json({ caption });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Caption generation failed" },
      { status: 502 }
    );
  }
}
