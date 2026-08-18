import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseServerClient, STORE_KEYS, type StoreKey } from "@/lib/supabase";

// PRD §3.2 + §14: same key semantics as v3 window.storage. Server storage
// rejects unknown keys. Auth required on all routes.

function isStoreKey(key: string | null): key is StoreKey {
  return !!key && (STORE_KEYS as readonly string[]).includes(key);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!isStoreKey(key)) {
    return NextResponse.json({ error: `Unknown store key: ${key}` }, { status: 400 });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ value: null });
    }
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("store").select("value, updated_at, updated_by").eq("key", key).single();

    if (error) {
      if (error.code === "PGRST116") {
        // No row found for key
        return NextResponse.json({ value: null }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
      }
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
  } catch (e) {
    console.warn(`Local store GET fallback for ${key}:`, e);
    return NextResponse.json({ value: null }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!isStoreKey(key)) {
    return NextResponse.json({ error: `Unknown store key: ${key}` }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: true });
    }
    const supabase = getSupabaseServerClient();
    // Last-write-wins (v1 conflict handling per §3.2) — client refetches on tab focus.
    const { error } = await supabase.from("store").upsert({
      key,
      value: body,
      updated_at: new Date().toISOString(),
      updated_by: session.user.email
    });

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }
  } catch (e) {
    console.warn(`Local store PUT fallback for ${key}:`, e);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
