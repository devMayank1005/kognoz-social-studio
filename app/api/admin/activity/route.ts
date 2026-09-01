import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { isAdmin } from "@/lib/adminAccess";
import { isMissingRelation } from "@/lib/activity";

// Reading the activity trail. Admin only — see lib/adminAccess.ts for why the gate is
// an env allowlist rather than users.role.
//
// The gate lives HERE as well as on the page. A page-only check protects the screen,
// not the data: anyone signed in could still fetch this URL directly and read every
// colleague's IP address and movements.

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdmin(session.user.email)) {
    // 403, not 404. The person is legitimately signed in; they simply are not an
    // admin, and telling them so is more useful than pretending the route is absent.
    return NextResponse.json({ error: "This page is limited to administrators." }, { status: 403 });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Activity storage is not configured." }, { status: 503 });
  }

  const params = req.nextUrl.searchParams;
  const who = (params.get("who") || "").trim();
  const source = (params.get("source") || "").trim();
  const days = Math.min(Math.max(Number(params.get("days")) || 7, 1), 365);
  const limit = Math.min(Math.max(Number(params.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const before = (params.get("before") || "").trim();

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const supabase = getSupabaseServerClient();
    let q = supabase
      .from("v_all_activity")
      .select("source, created_at, who, actor_name, action, entity, entity_label, screen, ip, user_agent, session_id, meta")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Substring, deliberately. Team Pulse stores a short handle ("mayank") where this
    // app stores an email, so an exact match would silently hide half of a person's
    // timeline the moment you filtered by either one.
    if (who) q = q.ilike("who", `%${who}%`);
    if (source === "studio" || source === "team-pulse") q = q.eq("source", source);
    // Keyset pagination on the timestamp — cheap, and stable while new rows arrive,
    // which offset pagination on a growing table is not.
    if (before) q = q.lt("created_at", before);

    const { data, error } = await q;

    if (error) {
      // PGRST205, not 42P01: PostgREST answers "no such relation" from its own schema
      // cache without ever reaching Postgres. Getting this wrong turns the one error an
      // admin is most likely to hit — opening the page before running the migration —
      // into an unexplained 500.
      if (isMissingRelation(error.code)) {
        return NextResponse.json(
          {
            error:
              "The activity log has not been set up yet — run supabase/migrations/2026-09-01_activity_log.sql in the Supabase SQL editor."
          },
          { status: 503 }
        );
      }
      console.error("admin activity query failed", error.message);
      return NextResponse.json({ error: "Could not read the activity log." }, { status: 500 });
    }

    const rows = data ?? [];
    return NextResponse.json({
      rows,
      // Present only when there may be more; the client stops paging when it is absent.
      nextBefore: rows.length === limit ? rows[rows.length - 1].created_at : null
    });
  } catch (e) {
    console.error("admin activity route threw", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not read the activity log." }, { status: 503 });
  }
}

/** The distinct people who appear in the trail, for the filter dropdown. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "This page is limited to administrators." }, { status: 403 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ people: [] });
  }

  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await getSupabaseServerClient()
      .from("v_all_activity")
      .select("who")
      .gte("created_at", since)
      .limit(5000);

    if (error) return NextResponse.json({ people: [] });

    const people = [...new Set((data ?? []).map((r) => r.who).filter(Boolean) as string[])].sort();
    return NextResponse.json({ people });
  } catch {
    return NextResponse.json({ people: [] });
  }
}
