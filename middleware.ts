import { SESSION_SECRET } from "@/lib/sessionSecret";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const SECRET = SESSION_SECRET;

/**
 * Refuse an unauthenticated request in the form its caller can actually read.
 *
 * WHAT THIS FIXES. Every exit below used to redirect to /login — including requests to
 * /api/*. The browser follows the 307, /login answers 200 HTML, so `res.ok` is true and the
 * client's `res.json()` throws on `<!DOCTYPE`. lib/storeClient.ts lands in its catch and
 * reports `stale: true`, and the Studio then tells somebody "Could not reach the server"
 * while they keep editing a deck that can never save. The cause was an ended session; the
 * message sent them to check their wifi.
 *
 * That storeClient carves out `res.status !== 401` is the giveaway that a 401 was always the
 * intent — that branch has been unreachable because this function never produced one.
 */
function deny(req: NextRequest): NextResponse {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  // The clone carries the original query string, which would otherwise ride along on the
  // login URL itself — /login?set=abc&callbackUrl=... The destination's parameters belong
  // in callbackUrl and nowhere else.
  url.search = "";
  // `search` as well as `pathname`: a deep link used to lose its query string across
  // sign-in and drop people on a bare screen after signing in.
  url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";

  // Redirect Vercel preview/deployment subdomains to canonical production domain
  // to ensure Microsoft OAuth cookies and callbacks match on the first click.
  if (
    host.endsWith(".vercel.app") &&
    host !== "kognoz-social-studio.vercel.app" &&
    !host.startsWith("localhost") &&
    !host.startsWith("127.0.0.1")
  ) {
    const canonicalUrl = req.nextUrl.clone();
    canonicalUrl.host = "kognoz-social-studio.vercel.app";
    canonicalUrl.protocol = "https:";
    return NextResponse.redirect(canonicalUrl, 307);
  }

  const { pathname } = req.nextUrl;

  // Allow public assets, login, and auth endpoints
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png"
  ) {
    return NextResponse.next();
  }

  // Check for presence of session cookie (handles both HTTPS __Secure- prefix and HTTP)
  const hasSecureCookie = req.cookies.has("__Secure-next-auth.session-token");
  const hasPlainCookie = req.cookies.has("next-auth.session-token");

  if (!hasSecureCookie && !hasPlainCookie) return deny(req);

  try {
    let token = null;
    if (hasSecureCookie) {
      token = await getToken({ req, secret: SECRET, secureCookie: true });
    }
    if (!token && hasPlainCookie) {
      token = await getToken({ req, secret: SECRET, secureCookie: false });
    }
    if (!token) {
      token = await getToken({ req, secret: SECRET });
    }

    if (!token) return deny(req);
  } catch (e) {
    console.error("Middleware auth check error:", e);
    return deny(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth endpoints)
     * - login (the sign in page)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - brand (public brand assets)
     * - favicon.ico, icon.png, apple-icon.png (App Router icon conventions)
     */
    "/((?!api/auth|login|_next/static|_next/image|brand|favicon.ico|icon.png|apple-icon.png).*)"
  ]
};
