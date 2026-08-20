import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "kognoz-social-studio-secure-auth-secret-key-2026";

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
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check for presence of session cookie (handles both HTTPS __Secure- prefix and HTTP)
  const hasSecureCookie = req.cookies.has("__Secure-next-auth.session-token");
  const hasPlainCookie = req.cookies.has("next-auth.session-token");

  if (!hasSecureCookie && !hasPlainCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

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

    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  } catch (e) {
    console.error("Middleware auth check error:", e);
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
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
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|login|_next/static|_next/image|brand|favicon.ico).*)"
  ]
};
