import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { STORE_KEYS } from "./supabase";
import { BRAND_IDS } from "./brands";

// ---------------------------------------------------------------------------
// The allowlist, the schema and the migration must list the same keys.
//
// They are three separate hand-maintained copies of one list, and lib/supabase.ts
// has warned about it in a comment since before there was a second brand:
//
//   "A key added here but not there is accepted by the route and rejected by
//    the database."
//
// The Konverz brand then shipped writing to `konverz-*` keys that were in NONE of
// the three. app/api/store/route.ts rejected every read with 400 before the
// database was reached, storeClient reported that as unreachable, and the
// calendar told people the server did not answer. Nothing threw, no test failed,
// and the whole Konverz side was silently unable to save anything.
//
// A comment cannot fail. This can.
// ---------------------------------------------------------------------------

const root = process.cwd();
const schemaSql = readFileSync(join(root, "supabase/schema.sql"), "utf8");

/** The keys inside the most recent `store_key_check` constraint in a SQL file. */
function constraintKeys(sql: string): string[] | null {
  const at = sql.lastIndexOf("store_key_check check (");
  if (at === -1) return null;
  const open = sql.indexOf("key in (", at);
  if (open === -1) return null;
  const close = sql.indexOf(")", open + "key in (".length);
  return Array.from(sql.slice(open, close).matchAll(/'([^']+)'/g), (m) => m[1]);
}

/** The keys inside the `key text primary key check (...)` column definition. */
function schemaColumnKeys(sql: string): string[] {
  const at = sql.indexOf("key text primary key check (");
  const close = sql.indexOf("),", at);
  return Array.from(sql.slice(at, close).matchAll(/'([^']+)'/g), (m) => m[1]);
}

// The migration that currently defines the constraint: the newest one that
// actually rewrites it, which is how a real database ends up configured.
const migrationsDir = join(root, "supabase/migrations");
const latestConstraintMigration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .reverse()
  .map((f) => ({ file: f, keys: constraintKeys(readFileSync(join(migrationsDir, f), "utf8")) }))
  .find((m) => m.keys !== null)!;

describe("store key allowlist", () => {
  const allow = [...STORE_KEYS].sort();

  it("the newest migration's constraint matches STORE_KEYS exactly", () => {
    expect(latestConstraintMigration, "no migration defines store_key_check").toBeTruthy();
    expect([...latestConstraintMigration.keys!].sort(), `from ${latestConstraintMigration.file}`).toEqual(allow);
  });

  it("a fresh database ends up with the same keys as a migrated one", () => {
    expect(schemaColumnKeys(schemaSql).sort()).toEqual(allow);
  });

  it("schema.sql seeds a row for every key, so a first read is empty rather than missing", () => {
    const seedBlock = schemaSql.slice(schemaSql.indexOf("insert into store (key, value) values"));
    // Only the FIRST quoted value in each tuple. The second is the '{}' literal,
    // which a looser regex happily collects as a thirteenth key.
    const seeded = Array.from(seedBlock.slice(0, seedBlock.indexOf(";")).matchAll(/\('([^']+)',/g), (m) => m[1]);
    expect([...new Set(seeded)].sort()).toEqual(allow);
  });

  // The actual regression: every brand needs every blob, and half a brand is worse
  // than none — it works until the first save.
  it("every brand has all seven of its keys allowlisted", () => {
    const perBrand = ["calendar", "house-prefs", "style-memory", "design", "voice-samples", "market-scan", "deck"];
    const missing: string[] = [];
    for (const id of BRAND_IDS) {
      for (const suffix of perBrand) {
        const key = `${id}-${suffix}`;
        if (!(STORE_KEYS as readonly string[]).includes(key)) missing.push(key);
      }
    }
    expect(missing, `add these to STORE_KEYS and to a migration: ${missing.join(", ")}`).toEqual([]);
  });

  it("the un-scoped keys are present too", () => {
    expect(STORE_KEYS).toContain("studio-brand");
  });

  it("holds no key that belongs to no brand and is not deliberately global", () => {
    const global = new Set(["studio-brand"]);
    for (const key of STORE_KEYS) {
      if (global.has(key)) continue;
      const brand = BRAND_IDS.find((id) => key.startsWith(`${id}-`));
      expect(brand, `"${key}" is scoped to no known brand`).toBeTruthy();
    }
  });
});
