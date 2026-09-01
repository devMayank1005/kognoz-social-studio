import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { withRequestOrigin } from "@/lib/requestContext";
import { clientIp } from "@/lib/activityEvents";

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

function withOrigin(req: NextRequest, ctx: unknown): Promise<Response> {
  return withRequestOrigin({ ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") }, () =>
    (handler as unknown as AuthHandler)(req, ctx)
  );
}

export { withOrigin as GET, withOrigin as POST };
