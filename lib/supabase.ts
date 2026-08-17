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

export const STORE_KEYS = [
  "kognoz-calendar",
  "kognoz-house-prefs",
  "kognoz-style-memory",
  "kognoz-design"
] as const;

export type StoreKey = (typeof STORE_KEYS)[number];
