import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signState } from "@/lib/state";
import { getAppUrl } from "@/lib/url";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile || profile.platform !== "TIKTOK") {
    return NextResponse.json({ error: "TikTok profile not found" }, { status: 404 });
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return NextResponse.json(
      { error: "TIKTOK_CLIENT_KEY is not configured. See .env.example." },
      { status: 501 }
    );
  }

  const redirectUri = `${getAppUrl(request)}/api/auth/tiktok/callback`;
  const state = signState({ profileId });

  const authorizeUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authorizeUrl.searchParams.set("client_key", clientKey);
  authorizeUrl.searchParams.set("scope", "user.info.basic,video.publish");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl);
}
