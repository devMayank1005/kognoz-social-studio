import { describe, it, expect } from "vitest";
import { isMissingRelation } from "./activity";

// Pinned because getting this wrong is invisible in code review and only shows up as a
// mystery 500 on the one day it matters — the first time someone opens the activity
// screen after deploying but before running the migration.
describe("isMissingRelation", () => {
  it("matches PostgREST's code, which is what actually fires", () => {
    // supabase-js talks to PostgREST, which answers "no such relation" from its own
    // schema cache and never reaches Postgres. The 42P01 you would expect from raw SQL
    // is never returned. Verified against the live project on 1 Sep 2026:
    //   {"code":"PGRST205","message":"Could not find the table 'public.v_all_activity'…"}
    expect(isMissingRelation("PGRST205")).toBe(true);
  });

  it("also matches the Postgres code, for a stale cache or a view over a missing table", () => {
    expect(isMissingRelation("42P01")).toBe(true);
  });

  it("does not swallow unrelated failures as 'not set up yet'", () => {
    // A permissions error or a broken column must surface as a real error, not as
    // advice to run a migration that has already been run.
    for (const other of ["42703", "PGRST116", "23505", "", null, undefined]) {
      expect(isMissingRelation(other)).toBe(false);
    }
  });
});
