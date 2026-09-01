#!/usr/bin/env node
// Admin script: creates (or updates) one login. This IS the allowlist —
// PRD §2: "no public signup". Run locally with the same env vars as
// production (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
//
// Usage:
//   npm run add-user "someone@example.com" "Their Name"                 <- generates a password
//   npm run add-user "someone@example.com" "Their Name" "their-password" <- sets one you chose
//   npm run add-user "someone@example.com" "Their Name" "" "handle"      <- pick the username
//
// The users table has a NOT NULL `username` with no default, so one is always written.
// It defaults to the lowercased local part of the email; pass a fourth argument to
// choose it. It is not used to sign in — lib/auth.ts looks accounts up by email.
//
// Prefer the first form. A password passed as an argument is written to your shell
// history and is visible in the process table to anyone on the machine while the
// command runs; a generated one is neither. Either way only the bcrypt hash is
// stored, never the plaintext.
//
// The email domain does not matter. The company-domain check in lib/auth.ts applies
// only to Azure AD sign-ins, so an account created here can be any address — which is
// the supported way to give access to someone outside the Microsoft tenant.
//
// Hand the password over on a channel you trust — a direct message or in person.
// Not email, and not a chat log.

import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const [, , email, name, providedPassword, providedUsername] = process.argv;

if (!email || !name) {
  console.error('Usage: npm run add-user "<email>" "<name>" ["<password>"]');
  console.error("Omit the password and a strong one is generated for you.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment first.");
  process.exit(1);
}

/**
 * A password worth typing once and pasting thereafter.
 *
 * randomInt from node:crypto, not Math.random — this is a credential. The alphabet
 * leaves out characters that are misread when someone copies it by hand or reads it
 * aloud: 0/O, 1/l/I. Five groups of five over a 55-character alphabet is ~145 bits,
 * far beyond anything that matters here, and the dashes make it survive being pasted
 * into a chat box.
 */
function generatePassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const groups = [];
  for (let g = 0; g < 5; g++) {
    let group = "";
    for (let i = 0; i < 5; i++) group += alphabet[randomInt(alphabet.length)];
    groups.push(group);
  }
  return groups.join("-");
}

// Lowercased to match authorize(), which lowercases the typed address and does an exact
// match — a row stored with any capital letter can never be found by the password form.
const normalisedEmail = email.toLowerCase().trim();
const username = (providedUsername || normalisedEmail.split("@")[0]).toLowerCase().trim();
const generated = !providedPassword;
const password = providedPassword || generatePassword();

const supabase = createClient(url, key);

// upsert() merges on the primary key, so running this for an existing address silently
// resets that person's password. Look first, so the script can say which of the two
// things it just did rather than quietly doing the more surprising one.
const { data: existing, error: lookupError } = await supabase
  .from("users")
  .select("email")
  .eq("email", normalisedEmail)
  .maybeSingle();

if (lookupError) {
  console.error("Failed to check for an existing user:", lookupError.message);
  process.exit(1);
}

// Cost 12, matching the bcrypt.compare in lib/auth.ts. Changing it here without
// changing that would still verify — bcrypt reads the cost from the hash — but keep
// them aligned so the intent stays obvious.
const password_hash = await bcrypt.hash(password, 12);

// `username` is required by the live table. Omitting it fails with a NOT NULL violation,
// which is exactly what this script used to do — supabase/schema.sql in this repo is out
// of date and shows only four of the eleven columns that actually exist.
const row = { email: normalisedEmail, name, password_hash, username };
const { error } = await supabase.from("users").upsert(row, { onConflict: "email" });

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}

if (existing) {
  console.log(`\nUpdated an existing account — ${normalisedEmail}`);
  console.log("Their previous password no longer works.");
} else {
  console.log(`\nCreated ${normalisedEmail} (username "${username}") — they can sign in with`);
  console.log("the password form at /login, not the Microsoft button.");
}

if (generated) {
  console.log("\n  Password:  " + password);
  console.log("\nThis is the only time it is shown. Copy it now and send it over a channel");
  console.log("you trust. It is not recoverable — re-run this command to set a new one.\n");
} else {
  console.log("\nPassword set to the one you supplied. Note it is now in your shell history;");
  console.log("clear that entry if the machine is shared.\n");
}
