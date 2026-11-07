import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/cookie-name";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // API: block cross-site requests that try to change data using a signed-in user's cookie (CSRF).
  if (path.startsWith("/api/")) {
    if (!SAFE_METHODS.has(req.method)) {
      const origin = req.headers.get("origin");
      let sameOrigin = false;
      try {
        sameOrigin = origin !== null && new URL(origin).host === req.nextUrl.host;
      } catch {
        sameOrigin = false;
      }
      if (!sameOrigin) return NextResponse.json({ error: "Request blocked." }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Pages: quick bounce to sign-in when there's no session cookie at all.
  // The real check (is the session valid, right role?) happens on the server for every page and API call.
  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/s/:path*", "/stores", "/api/:path*"],
};
