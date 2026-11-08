import { NextResponse, type NextRequest } from "next/server";
import { siteOrigins } from "./lib/origins";

/**
 * Cross-site protection: form submissions to the API must come from this app or from the
 * Qalb-E-Abbas website (MAIN_SITE_URL / ALLOWED_ORIGINS). Stripe webhooks are exempt —
 * they are verified with Stripe's signature instead.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (req.method === "POST" && !pathname.startsWith("/api/webhooks/")) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const sameSite = !!origin && new URL(origin).host === host;
    if (!sameSite && !(origin && siteOrigins().has(origin))) {
      return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
