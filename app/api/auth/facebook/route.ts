import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signState } from "@/lib/state";
import { getAppUrl } from "@/lib/url";

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION ?? "v21.0";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile || profile.platform !== "FACEBOOK") {
    return NextResponse.json({ error: "Facebook profile not found" }, { status: 404 });
  }

  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: "FACEBOOK_APP_ID is not configured. See .env.example." },
      { status: 501 }
    );
  }

  const redirectUri = `${getAppUrl(request)}/api/auth/facebook/callback`;
  const state = signState({ profileId });

  const authorizeUrl = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  authorizeUrl.searchParams.set("client_id", appId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set(
    "scope",
    "pages_show_list,pages_manage_posts,pages_read_engagement"
  );
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl);
}
