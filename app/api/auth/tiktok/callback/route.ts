import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyState } from "@/lib/state";
import { getAppUrl } from "@/lib/url";

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
    return NextResponse.redirect(`${appUrl}/profiles/${profileId}?error=tiktok_denied`);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/profiles/${profileId}?error=tiktok_not_configured`);
  }

  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${appUrl}/api/auth/tiktok/callback`,
    }),
  });

  const token = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !token?.access_token) {
    return NextResponse.redirect(`${appUrl}/profiles/${profileId}?error=tiktok_token_exchange`);
  }

  let accountName: string | null = null;
  try {
    const infoRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=display_name",
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    );
    const info = await infoRes.json();
    accountName = info?.data?.user?.display_name ?? null;
  } catch {
    // Non-fatal; the connection still succeeds without a display name.
  }

  await db.profile.update({
    where: { id: profileId },
    data: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      externalAccountId: token.open_id ?? null,
      accountName,
      connected: true,
    },
  });

  return NextResponse.redirect(`${appUrl}/profiles/${profileId}?connected=1`);
}
