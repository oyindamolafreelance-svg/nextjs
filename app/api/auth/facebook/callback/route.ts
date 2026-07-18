import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyState } from "@/lib/state";
import { getAppUrl } from "@/lib/url";

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION ?? "v21.0";
const API_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const payload = state ? verifyState(state) : null;
  const profileId = payload?.profileId;

  if (!profileId) {
    return NextResponse.redirect(`${appUrl}/profiles?error=invalid_state`);
  }
  if (oauthError || !code) {
    return NextResponse.redirect(`${appUrl}/profiles/${profileId}?error=facebook_denied`);
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(`${appUrl}/profiles/${profileId}?error=facebook_not_configured`);
  }

  const redirectUri = `${appUrl}/api/auth/facebook/callback`;

  const shortTokenRes = await fetch(
    `${API_BASE}/oauth/access_token?` +
      new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, client_secret: appSecret, code })
  );
  const shortToken = await shortTokenRes.json().catch(() => null);
  if (!shortTokenRes.ok || !shortToken?.access_token) {
    return NextResponse.redirect(`${appUrl}/profiles/${profileId}?error=facebook_token_exchange`);
  }

  // Exchange for a long-lived user token so the resulting Page tokens don't expire quickly.
  const longTokenRes = await fetch(
    `${API_BASE}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken.access_token,
      })
  );
  const longToken = await longTokenRes.json().catch(() => null);
  const userAccessToken = longToken?.access_token ?? shortToken.access_token;

  const pagesRes = await fetch(
    `${API_BASE}/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`
  );
  const pages = await pagesRes.json().catch(() => null);
  const page = pages?.data?.[0];

  if (!page) {
    return NextResponse.redirect(`${appUrl}/profiles/${profileId}?error=facebook_no_pages`);
  }

  await db.profile.update({
    where: { id: profileId },
    data: {
      accessToken: page.access_token,
      externalPageId: page.id,
      accountName: page.name ?? null,
      connected: true,
      tokenExpiresAt: null, // Page tokens derived from a long-lived user token don't expire.
    },
  });

  return NextResponse.redirect(`${appUrl}/profiles/${profileId}?connected=1`);
}
