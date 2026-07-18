import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyState } from "@/lib/state";
import { SESSION_COOKIE } from "@/lib/session";

export function proxy(request: NextRequest) {
  // No password configured: gate is disabled (fine for local dev, not for a public deploy).
  if (!process.env.APP_PASSWORD) {
    return NextResponse.next();
  }

  const isAuthed = () => {
    try {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      if (!token) return false;
      const payload = verifyState(token);
      return payload?.ok === "1" && Number(payload.exp) > Date.now();
    } catch {
      // Misconfigured APP_SECRET, or a tampered/corrupt cookie: fail closed.
      return false;
    }
  };

  if (isAuthed()) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico|login).*)"],
};
