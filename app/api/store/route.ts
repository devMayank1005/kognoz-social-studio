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
    let { data, error } = await supabase
      .from("store")
      .select("value, updated_at, updated_by, version")
      .eq("key", key)
      .single();

    if (error?.code === "42703") {
      // Pre-migration database: read without the version column. Writes then go
      // out unversioned, exactly as they did before locking existed.
      ({ data, error } = await supabase
        .from("store")
        .select("value, updated_at, updated_by")
        .eq("key", key)
        .single());
    }

    if (error) {
      if (error.code === "PGRST116") {
        // No row found for key
        return NextResponse.json({ value: null, version: 0 }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
      }
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
  } catch (e) {
    console.warn(`Local store GET fallback for ${key}:`, e);
    return NextResponse.json({ value: null, version: 0 }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
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

    // Optimistic locking. The client sends the version it last read in
    // X-Store-Version; we only write if the row is still at that version.
    // Without this the upsert was blind, and two admins editing the same blob
    // meant the second save silently destroyed the first one's work.
    //
    // A request with no header is treated as an unconditional write, so a browser
    // tab still running the previous build behaves exactly as it did before
    // rather than breaking mid-deploy.
    const raw = req.headers.get("x-store-version");
    const expected = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
    const stamp = { value: body, updated_at: new Date().toISOString(), updated_by: session.user.email };

    if (expected === null) {
      const { error } = await supabase.from("store").upsert({ key, ...stamp });
      if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const { data: updated, error: updateError } = await supabase
      .from("store")
      .update({ ...stamp, version: expected + 1 })
      .eq("key", key)
      .eq("version", expected)
      .select("version")
      .maybeSingle();

    if (updateError) {
      // 42703 = undefined_column. The migration adding `version` has not run yet on
      // this database. Degrade to the previous unconditional write rather than
      // failing every save: deploy order should not be able to take the app down.
      if (updateError.code === "42703") {
        console.warn("store: version column missing — run the optimistic-locking migration");
        const { error } = await supabase.from("store").upsert({ key, ...stamp });
        if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
        return NextResponse.json({ ok: true, unversioned: true });
      }
      return NextResponse.json({ error: updateError.message, code: updateError.code }, { status: 500 });
    }

    if (!updated) {
      // Either someone wrote first, or the row does not exist yet. Read back the
      // current state so the client can reconcile instead of guessing.
      const { data: current } = await supabase
        .from("store")
        .select("value, version, updated_at, updated_by")
        .eq("key", key)
        .maybeSingle();

      if (!current) {
        const { data: inserted, error: insertError } = await supabase
          .from("store")
          .insert({ key, ...stamp, version: 1 })
          .select("version")
          .maybeSingle();
        if (insertError) {
          return NextResponse.json({ error: insertError.message, code: insertError.code }, { status: 500 });
        }
        return NextResponse.json({ ok: true, version: inserted?.version ?? 1 });
      }

      return NextResponse.json(
        {
          error: "This was changed by someone else while you were editing.",
          code: "version_conflict",
          value: current.value,
          version: current.version,
          updated_by: current.updated_by,
          updated_at: current.updated_at
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, version: updated.version });
  } catch (e) {
    console.warn(`Local store PUT fallback for ${key}:`, e);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
