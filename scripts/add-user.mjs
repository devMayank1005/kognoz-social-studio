#!/usr/bin/env node
// Admin script: creates (or updates) one login. This IS the allowlist —
// PRD §2: "no public signup". Run locally with the same env vars as
// production (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
//
// Usage:
//   node scripts/add-user.mjs "lokesh@kognozconsulting.com" "Lokesh" "some-strong-password"
//
// Prints nothing sensitive; the plaintext password is never stored, only its
// bcrypt hash. Give the plaintext to the person over a separate, non-email
// channel (Slack DM, in person) — do not paste it into a chat log.

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const [, , email, name, password] = process.argv;

if (!email || !name || !password) {
  console.error('Usage: node scripts/add-user.mjs "<email>" "<name>" "<password>"');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment first.");
  process.exit(1);
}

const supabase = createClient(url, key);
const password_hash = await bcrypt.hash(password, 12);

const { error } = await supabase
  .from("users")
  .upsert({ email: email.toLowerCase().trim(), name, password_hash });

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}

console.log(`OK — ${email} can now sign in.`);
