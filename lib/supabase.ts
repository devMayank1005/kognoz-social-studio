import { createClient } from "@supabase/supabase-js";

// Server-only client. Uses the service-role key — never import this file from
// a "use client" component. Route handlers only.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — set in Vercel env (see .env.example)"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Keep in sync with the CHECK constraint on store.key — schema.sql and the
// migrations under supabase/migrations/. A key added here but not there is
// accepted by the route and rejected by the database.
//
// That warning was written before the Konverz brand arrived and then ignored by
// it: the brand-scoped keys went into neither list, so every Konverz read came
// back 400 from the route and the calendar reported "the server did not answer".
// lib/storeKeys.test.ts now checks this file against the migration, so the next
// half-added key fails a test instead of a person.
//
// NOT derived from lib/brands.ts on purpose. That module pulls in ~300KB of
// base64 logo data, which has no business in a server route bundle. The test
// does the cross-check instead.
export const STORE_KEYS = [
  "kognoz-calendar",
  "kognoz-house-prefs",
  "kognoz-style-memory",
  "kognoz-design",
  // Real, human-written posts the model imitates. See lib/voiceSamples.ts for
  // why this is not the same thing as kognoz-style-memory.
  "kognoz-voice-samples",
  // Current, sourced problems in the brand's market, found by a grounded scan and
  // then edited by a person. What the month planner writes topics from, so a
  // month is built on problems somebody has rather than on plausible ones.
  "kognoz-market-scan",
  // The working deck: slides, images, per-slide text scale and the canvas elements.
  // Until this existed a refresh threw away an afternoon of hand-positioning.
  "kognoz-deck",

  // Konverz AI. Same five blobs plus its own scan; separate data, same shapes.
  "konverz-calendar",
  "konverz-house-prefs",
  "konverz-style-memory",
  "konverz-design",
  "konverz-voice-samples",
  "konverz-market-scan",
  "konverz-deck",

  // Which brand this user last worked in. Not brand-scoped, by definition. Kept
  // on the server as well as in localStorage so the choice follows a person to
  // another machine rather than silently reverting to Kognoz.
  "studio-brand"
] as const;

export type StoreKey = (typeof STORE_KEYS)[number];
