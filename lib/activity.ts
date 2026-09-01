// Writing to the activity trail. Server-only — this reaches Supabase with the
// service-role key, so it must never be imported from a "use client" component.
//
// The one rule that governs this file: RECORDING MUST NEVER BREAK THE THING IT IS
// RECORDING. A logging failure cannot be allowed to fail a sign-in, lose a save, or
// surface an error to the user. Everything here swallows its own errors and reports
// them to the server console, the same way `logAttempt` does in app/api/claude/route.ts.
//
// That is a deliberate trade: a trail with gaps beats an app that falls over when the
// audit table is unreachable.

import { getSupabaseServerClient } from "@/lib/supabase";
import { clampMeta, type Action } from "@/lib/activityEvents";

export interface ActivityInput {
  actorEmail: string;
  actorName?: string | null;
  action: Action;
  entity?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  screen?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  meta?: unknown;
}

/** Column widths are generous, but a runaway client should still not set the size. */
const MAX_LABEL = 300;
const MAX_UA = 500;

/** True when the error means "that table or view does not exist". */
export function isMissingRelation(code: string | null | undefined): boolean {
  return code === "PGRST205" || code === "42P01";
}

const trim = (v: string | null | undefined, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

/**
 * Record one action.
 *
 * Resolves to true when the row landed and false when it did not. Callers are free to
 * ignore the result — most do — but a route that wants to warn can.
 *
 * Never rejects. Never throws.
 */
export async function recordActivity(input: ActivityInput): Promise<boolean> {
  try {
    // An event with no actor cannot answer "who did this", which is the only
    // question the table exists for. Drop it rather than storing an orphan row.
    const actorEmail = trim(input.actorEmail, 320)?.toLowerCase();
    if (!actorEmail) return false;

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("studio_activity").insert({
      actor_email: actorEmail,
      actor_name: trim(input.actorName, 200),
      action: input.action,
      entity: trim(input.entity, 40),
      entity_id: trim(input.entityId, 100),
      entity_label: trim(input.entityLabel, MAX_LABEL),
      screen: trim(input.screen, 40),
      ip: trim(input.ip, 60),
      user_agent: trim(input.userAgent, MAX_UA),
      session_id: trim(input.sessionId, 60),
      meta: clampMeta(input.meta)
    });

    if (error) {
      // The migration has not been run on this database yet. Say so by name — the
      // alternative is a mystery warning on every action the user takes.
      //
      // PGRST205 is the one that actually fires: PostgREST answers from its schema
      // cache and never reaches Postgres, so the 42P01 you would expect from raw SQL
      // does not appear. Both are matched because a view over a missing table, or a
      // stale cache, can still surface the Postgres code.
      if (isMissingRelation(error.code)) {
        console.warn("activity: studio_activity table missing — run supabase/migrations/2026-09-01_activity_log.sql");
      } else {
        console.error("activity insert failed", error.message);
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error("activity insert threw", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Record without making the caller wait.
 *
 * For paths where the user is mid-flow — a sign-in callback, a save — and the extra
 * round trip is not worth the latency. The floating promise is deliberate and its
 * rejection handler is already inside recordActivity, so nothing can escape.
 */
export function recordActivityAsync(input: ActivityInput): void {
  void recordActivity(input);
}
