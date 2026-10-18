import { NextResponse, type NextRequest } from "next/server";
import { siteOrigins } from "./lib/origins";

/**
 * CSRF protection: state-changing API requests must come from this site.
 * (Session cookies are also SameSite=Lax.) Webhooks and cron are exempt —
 * they authenticate with signatures/secrets instead.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)
      && !pathname.startsWith("/api/webhooks/") && !pathname.startsWith("/api/cron")) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    // The website cart and assessment may post cross-site (cookie-less endpoints, allowed origins only).
    const siteOrder = (pathname === "/api/orders" || pathname === "/api/assessments") && !!origin && siteOrigins().has(origin);
    if (!siteOrder && (!origin || new URL(origin).host !== host)) {
      return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
    }
  }
  // Fast path: send signed-out visitors to the right login page (server pages re-check roles).
  if ((pathname.startsWith("/admin") && pathname !== "/admin/login") && !req.cookies.get("qa_session")) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  if (pathname.startsWith("/account") && !/^\/account\/(login|register|verify|forgot|reset)/.test(pathname) && !req.cookies.get("qa_session")) {
    return NextResponse.redirect(new URL(`/account/login?next=${encodeURIComponent(pathname)}`, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/admin/:path*", "/account/:path*"] };
