import { describe, it, expect } from "vitest";
import { buildCommands, filterCommands, moveSelection, clampSelection } from "./commandPalette";
import { NAV_ITEMS } from "./navigation";

const ctx = (over: Partial<Parameters<typeof buildCommands>[0]> = {}) => ({
  isAdmin: false,
  currentBrand: "kognoz" as const,
  ...over
});

describe("what the palette offers", () => {
  it("derives destinations from the nav registry rather than a second list", () => {
    // The reference hardcodes its own list, which is how its palette ended up
    // advertising "24 Planned Items" from mock data. Deriving keeps them in step.
    const ids = buildCommands(ctx({ isAdmin: true })).filter((c) => c.kind === "navigate").map((c) => c.navId);
    const expected = NAV_ITEMS.filter((i) => !i.modal).map((i) => i.id);
    expect(ids).toEqual(expected);
  });

  it("applies the same admin gate as the sidebar", () => {
    // Listing a destination the person cannot open is worse than omitting it.
    expect(buildCommands(ctx()).map((c) => c.navId)).not.toContain("audit");
    expect(buildCommands(ctx({ isAdmin: true })).map((c) => c.navId)).toContain("audit");
  });

  it("omits Settings, which is reached from the rail", () => {
    expect(buildCommands(ctx({ isAdmin: true })).map((c) => c.navId)).not.toContain("settings");
  });

  it("carries an href for every destination, so selecting one can navigate", () => {
    for (const c of buildCommands(ctx({ isAdmin: true })).filter((c) => c.kind === "navigate")) {
      expect(c.href, `${c.id} has no href`).toBeTruthy();
    }
  });

  it("never offers the brand you are already in", () => {
    const k = buildCommands(ctx({ currentBrand: "kognoz" }));
    expect(k.filter((c) => c.kind === "brand").map((c) => c.brandId)).toEqual(["konverz"]);

    const z = buildCommands(ctx({ currentBrand: "konverz" }));
    expect(z.filter((c) => c.kind === "brand").map((c) => c.brandId)).toEqual(["kognoz"]);
  });

  it("offers fact-check and export only where they mean something", () => {
    // On the calendar there is no deck to verify or export.
    const bare = buildCommands(ctx()).map((c) => c.actionId);
    expect(bare).not.toContain("fact-check");
    expect(bare).not.toContain("export");

    const studio = buildCommands(ctx({ canFactCheck: true, canExport: true })).map((c) => c.actionId);
    expect(studio).toContain("fact-check");
    expect(studio).toContain("export");
  });

  it("gives every command a unique id and a category chip", () => {
    const all = buildCommands(ctx({ isAdmin: true, canFactCheck: true, canExport: true }));
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    for (const c of all) expect(c.category.length).toBeGreaterThan(0);
  });
});

describe("filterCommands", () => {
  const all = buildCommands(ctx({ isAdmin: true, canFactCheck: true, canExport: true }));

  it("returns everything for an empty query", () => {
    expect(filterCommands(all, "")).toHaveLength(all.length);
    expect(filterCommands(all, "   ")).toHaveLength(all.length);
  });

  it("matches a substring, not just a prefix", () => {
    // People type the distinctive middle of a word as often as the start.
    expect(filterCommands(all, "verif").length).toBeGreaterThan(0);
    expect(filterCommands(all, "panorama").length).toBeGreaterThan(0);
  });

  it("requires every term, so two words narrow rather than widen", () => {
    const one = filterCommands(all, "brand");
    const two = filterCommands(all, "brand konverz");
    expect(two.length).toBeGreaterThan(0);
    expect(two.length).toBeLessThanOrEqual(one.length);
  });

  it("searches the category as well as the title", () => {
    expect(filterCommands(all, "publish").map((c) => c.actionId)).toContain("export");
  });

  it("ignores case", () => {
    expect(filterCommands(all, "CALENDAR")).toEqual(filterCommands(all, "calendar"));
  });

  it("returns nothing for a query that matches nothing", () => {
    expect(filterCommands(all, "zzzzzz")).toHaveLength(0);
  });
});

describe("keyboard selection", () => {
  it("moves down and up", () => {
    expect(moveSelection(0, 1, 5)).toBe(1);
    expect(moveSelection(3, -1, 5)).toBe(2);
  });

  it("wraps at both ends, so the list is never a dead end", () => {
    expect(moveSelection(4, 1, 5)).toBe(0);
    expect(moveSelection(0, -1, 5)).toBe(4);
  });

  it("survives an empty list rather than indexing into nothing", () => {
    expect(moveSelection(0, 1, 0)).toBe(0);
    expect(moveSelection(3, -1, 0)).toBe(0);
  });

  it("clamps the highlight when the list shrinks under a new query", () => {
    // Typing narrows 11 results to 2 while the highlight sits on row 7.
    expect(clampSelection(7, 2)).toBe(1);
    expect(clampSelection(0, 5)).toBe(0);
    expect(clampSelection(-1, 5)).toBe(0);
    expect(clampSelection(2, 0)).toBe(0);
  });
});
