import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Platform } from "@/lib/generated/prisma/enums";

const PLATFORMS: Platform[] = ["TIKTOK", "FACEBOOK"];

export async function GET() {
  const profiles = await db.profile.findMany({
    orderBy: { createdAt: "desc" },
    omit: { accessToken: true, refreshToken: true },
  });
  return NextResponse.json({ profiles });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, platform, niche, brandTone, brandColors, brandHashtags, logoUrl } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "platform must be TIKTOK or FACEBOOK" }, { status: 400 });
  }
  if (!niche || typeof niche !== "string") {
    return NextResponse.json({ error: "niche is required" }, { status: 400 });
  }

  const profile = await db.profile.create({
    data: {
      name,
      platform,
      niche,
      brandTone: typeof brandTone === "string" ? brandTone : null,
      brandColors: Array.isArray(brandColors) ? brandColors.filter((c) => typeof c === "string") : [],
      brandHashtags: Array.isArray(brandHashtags)
        ? brandHashtags.filter((h) => typeof h === "string")
        : [],
      logoUrl: typeof logoUrl === "string" ? logoUrl : null,
    },
    omit: { accessToken: true, refreshToken: true },
  });

  return NextResponse.json({ profile }, { status: 201 });
}
