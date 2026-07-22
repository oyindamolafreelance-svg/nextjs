import type { NextRequest } from "next/server";

/** Prefer a fixed APP_URL in production so OAuth redirect_uri stays stable behind proxies. */
export function getAppUrl(request: NextRequest): string {
  return process.env.APP_URL ?? request.nextUrl.origin;
}
