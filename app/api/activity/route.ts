import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { recordActivity } from "@/lib/activity";
import { isClientAction, clientIp, toScreen } from "@/lib/activityEvents";

// Where the browser reports what the user just did.
//
// The security model is one sentence: THE CLIENT SAYS WHAT HAPPENED, THE SERVER SAYS
// WHO DID IT AND FROM WHERE. Identity comes from the session cookie and the address
// comes from the request headers; neither is ever read from the body. A page that
// posts `{ actorEmail: "someone.else@..." }` is simply ignored — see the test in
// the verification steps.
//
// The action must also be one of the six a browser is allowed to send
// (lib/activityEvents.ts). `login` is not among them: a trail that can be told about
// sign-ins that never happened is worse than no trail, because it still looks
// authoritative.

// Bursty by nature — a deck export fires one call per download batch — but no honest
// client comes anywhere near this. It exists so a loop in a stuck tab cannot fill the
// table, not to police normal use.
const ACTIVITY_LIMIT_PER_HOUR = 600;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorEmail = session.user.email;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Reject rather than silently coerce. An unknown action means the client and the
  // server disagree about the vocabulary, and quietly storing a fallback would hide
  // that until someone read the table months later and found a column of "unknown".
  if (!isClientAction(body.action)) {
    return NextResponse.json({ error: `Action not permitted from a client: ${String(body.action)}` }, { status: 400 });
  }

  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

  // Rate limit, using the same rolling-count shape as the Claude route. A failure to
  // COUNT must not block the write: the limiter is a backstop, and losing audit rows
  // because a count query hiccuped is the worse outcome.
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await getSupabaseServerClient()
        .from("studio_activity")
        .select("id", { count: "exact", head: true })
        .eq("actor_email", actorEmail.toLowerCase())
        .gte("created_at", since);

      if (!error && (count ?? 0) >= ACTIVITY_LIMIT_PER_HOUR) {
        // 204, not 429. The client is fire-and-forget and ignores the response; a 429
        // would only put a red line in the user's console for something that is not
        // their problem.
        console.warn(`activity: hourly cap reached for ${actorEmail}`);
        return new NextResponse(null, { status: 204 });
      }
    }
  } catch (e) {
    console.warn("activity: rate-limit check failed, allowing the write", e instanceof Error ? e.message : e);
  }

  await recordActivity({
    // Session and headers only. Anything the body claims about identity or origin is
    // ignored by construction: those fields are never read from `body`.
    actorEmail,
    actorName: session.user.name,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),

    action: body.action,
    entity: str(body.entity),
    entityId: str(body.entityId),
    entityLabel: str(body.entityLabel),
    screen: toScreen(body.screen),
    sessionId: str(body.sessionId),
    meta: body.meta
  });

  // Always 204, even when the insert failed. The caller cannot do anything useful
  // with the difference, and recordActivity has already logged it server-side.
  return new NextResponse(null, { status: 204 });
}
