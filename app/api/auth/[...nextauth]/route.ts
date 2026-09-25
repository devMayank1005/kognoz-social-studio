import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { withRequestOrigin } from "@/lib/requestContext";
import { clientIp } from "@/lib/activityEvents";

/**
 * Never prerendered.
 *
 * Next EXECUTES a route handler during "Generating static pages" to discover whether it is
 * dynamic. This one reads the session on every call, so a prerendered copy would be a
 * response computed at build time with no user attached — and executing it at build made the
 * deploy depend on runtime secrets being present while compiling, which is what broke it.
 */
export const dynamic = "force-dynamic";

if (!process.env.NEXTAUTH_URL) {
  if (process.env.NODE_ENV === "production") {
    process.env.NEXTAUTH_URL = "https://kognoz-social-studio.vercel.app";
  } else if (process.env.RENDER_EXTERNAL_URL) {
    process.env.NEXTAUTH_URL = process.env.RENDER_EXTERNAL_URL;
  }
}

const handler = NextAuth(authOptions);

/**
 * The NextAuth handler, wrapped so the caller's IP and device are visible inside it.
 *
 * NextAuth's sign-in callbacks receive no request, so this is the only place the
 * origin of a sign-in can be captured. See lib/requestContext.ts for why an
 * AsyncLocalStorage rather than the `req` argument `authorize()` gets — that argument
 * exists only for the password provider, which would have left every Microsoft
 * sign-in logged without an address.
 *
 * The wrapper adds no behaviour of its own: whatever NextAuth returns is returned
 * unchanged, so auth cannot break because logging is in the way.
 */
type AuthHandler = (req: NextRequest, ctx: unknown) => Promise<Response>;

async function withOrigin(req: NextRequest, ctx: unknown): Promise<Response> {
  try {
    return await withRequestOrigin({ ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") }, () =>
      (handler as unknown as AuthHandler)(req, ctx)
    );
  } catch (e) {
    // Still fails closed — no session is issued — but in a form the caller can read.
    //
    // An unhandled throw here (e.g. lib/sessionSecret.ts refusing a blank NEXTAUTH_SECRET)
    // became a 500 with an EMPTY body: next-auth/react logged "Unexpected end of JSON input",
    // then signIn() navigated the whole tab to /api/auth/error, which 500'd too and left
    // people on chrome-error://. "Configuration" is next-auth's own name for this failure.
    console.error("[auth] handler failed:", e);
    if (req.method === "GET" && (req.headers.get("accept") || "").includes("text/html")) {
      return NextResponse.redirect(new URL("/login?error=Configuration", req.url));
    }
    return NextResponse.json({ error: "Configuration" }, { status: 500 });
  }
}

export { withOrigin as GET, withOrigin as POST };
