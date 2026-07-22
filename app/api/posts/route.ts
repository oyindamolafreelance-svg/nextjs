import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateCaption } from "@/lib/ai/caption";
import { PostStatus } from "@/lib/generated/prisma/enums";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");
  const status = searchParams.get("status");

  const where: { profileId?: string; status?: PostStatus } = {};
  if (profileId) where.profileId = profileId;
  if (status && status in PostStatus) where.status = status as PostStatus;

  const posts = await db.post.findMany({
    where,
    include: { profile: { select: { id: true, name: true, platform: true, niche: true } } },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { profileId, caption, generateWithAi, topic, mediaUrl, mediaType, scheduledAt } = body;

  if (!profileId || typeof profileId !== "string") {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  let finalCaption = typeof caption === "string" ? caption : "";
  let source: "MANUAL" | "AI_GENERATED" = "MANUAL";

  if (generateWithAi) {
    finalCaption = await generateCaption({
      platform: profile.platform,
      niche: profile.niche,
      brandTone: profile.brandTone,
      brandHashtags: profile.brandHashtags,
      topic: typeof topic === "string" ? topic : undefined,
    });
    source = "AI_GENERATED";
  }

  if (!finalCaption) {
    return NextResponse.json(
      { error: "caption is required (or set generateWithAi to true)" },
      { status: 400 }
    );
  }

  let scheduledDate: Date | null = null;
  if (scheduledAt) {
    scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "scheduledAt is not a valid date" }, { status: 400 });
    }
  }

  const post = await db.post.create({
    data: {
      profileId,
      caption: finalCaption,
      mediaUrl: typeof mediaUrl === "string" ? mediaUrl : null,
      mediaType: mediaType === "IMAGE" || mediaType === "VIDEO" ? mediaType : null,
      source,
      status: scheduledDate ? "SCHEDULED" : "DRAFT",
      scheduledAt: scheduledDate,
    },
  });

  return NextResponse.json({ post }, { status: 201 });
}
