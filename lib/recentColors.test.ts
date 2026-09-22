import { describe, it, expect } from "vitest";
import { MAX_RECENT, addRecent, parseRecent, serialiseRecent } from "./recentColors";

// The list logic is pure so it can be tested without a DOM; the two localStorage calls that
// use it are three lines each and wrapped in try/catch, because a private window and blocked
// site data both throw on access and neither is a reason a colour picker should fail to open.

describe("addRecent", () => {
  it("puts the newest colour first", () => {
    expect(addRecent(["#111111"], "#222222")).toEqual(["#222222", "#111111"]);
  });

  it("moves a colour already in the list rather than repeating it", () => {
    expect(addRecent(["#111111", "#222222"], "#222222")).toEqual(["#222222", "#111111"]);
  });

  it("treats one colour written two ways as one colour", () => {
    // Two swatches of the same colour is the kind of bug people spot instantly.
    expect(addRecent(["#43AFCD"], "#43afcd")).toEqual(["#43afcd"]);
  });

  it("stores the colour as given, even though it compares case-insensitively", () => {
    expect(addRecent([], "#43AFCD")).toEqual(["#43AFCD"]);
  });

  it("forgets the oldest once it is full", () => {
    const full = Array.from({ length: MAX_RECENT }, (_, i) => `#${String(i).padStart(6, "0")}`);
    const next = addRecent(full, "#ffffff");
    expect(next).toHaveLength(MAX_RECENT);
    expect(next[0]).toBe("#ffffff");
    expect(next).not.toContain(full[MAX_RECENT - 1]);
  });

  it("ignores an empty pick instead of storing a blank swatch", () => {
    expect(addRecent(["#111111"], "")).toEqual(["#111111"]);
    expect(addRecent(["#111111"], "   ")).toEqual(["#111111"]);
  });

  it("does not mutate the list it was given", () => {
    const before = ["#111111"];
    addRecent(before, "#222222");
    expect(before).toEqual(["#111111"]);
  });
});

describe("parseRecent", () => {
  it("reads back what serialiseRecent wrote", () => {
    const list = ["#111111", "#222222"];
    expect(parseRecent(serialiseRecent(list))).toEqual(list);
  });

  it("returns an empty list for anything unusable rather than throwing", () => {
    // This runs when the picker opens. A corrupt value must not stop somebody choosing a
    // colour — the worst acceptable outcome is an empty Recent row.
    for (const junk of [null, "", "not json", "{}", '"a string"', "[1, 2, 3]"]) {
      expect(parseRecent(junk), junk ?? "null").toEqual([]);
    }
  });

  it("keeps the usable entries out of a partly corrupt list", () => {
    expect(parseRecent('["#111111", 42, null, "", "#222222"]')).toEqual(["#111111", "#222222"]);
  });

  it("caps a list that grew too long somewhere else", () => {
    const many = JSON.stringify(Array.from({ length: 100 }, () => "#000000"));
    expect(parseRecent(many)).toHaveLength(MAX_RECENT);
  });
});
