import { describe, it, expect } from "vitest";
import { coercePlan, toContentItems, occupiedDates, snapTo, toDateKey, daysInMonth } from "./calendarPlan";
import { PILLARS_LIST, ALL_CONTENT_TYPES } from "../components/calendar/types";
import { CHANNEL_IDS } from "./founderProfiles";
import { formatDateKey } from "../components/calendar/calendarUtils";

// A month plan arrives from a model, so nothing in it can be trusted: a pillar that does
// not exist, a 31st of February, a day that already has a post. The whole point of this
// module is that none of those becomes calendar data.

const entry = (over: Record<string, unknown> = {}) => ({
  day: 3,
  channel: "Lokesh",
  format: "Text post",
  pillar: "Behavioral Signal",
  topic: "The survey said empowered, while decisions travelled two levels up",
  ...over
});

const opts = (over: Record<string, unknown> = {}) => ({
  year: 2026,
  month: 8, // September, 0-indexed
  occupied: new Set<string>(),
  ...over
});

describe("dates match what the rest of the calendar produces", () => {
  it("agrees with formatDateKey, the app's existing contract", () => {
    // The calendar groups strictly by this string. Disagreeing by one character would put
    // every generated post in a day cell that does not exist.
    expect(toDateKey(2026, 7, 20)).toBe(formatDateKey(2026, 7, 20));
    expect(toDateKey(2026, 0, 1)).toBe(formatDateKey(2026, 0, 1));
    expect(toDateKey(2026, 11, 31)).toBe(formatDateKey(2026, 11, 31));
  });

  it("zero-pads single digits", () => {
    expect(toDateKey(2026, 8, 5)).toBe("2026-09-05");
  });

  it("knows how long each month actually is", () => {
    expect(daysInMonth(2026, 8)).toBe(30); // September
    expect(daysInMonth(2026, 0)).toBe(31); // January
    expect(daysInMonth(2026, 1)).toBe(28); // February 2026
    expect(daysInMonth(2028, 1)).toBe(29); // leap year
  });
});

describe("snapTo", () => {
  it("accepts an exact value", () => {
    expect(snapTo("Human + AI", PILLARS_LIST, "Behavioral Signal")).toBe("Human + AI");
  });

  it("forgives case and spacing rather than throwing away a usable entry", () => {
    expect(snapTo("human + ai", PILLARS_LIST, "Behavioral Signal")).toBe("Human + AI");
    expect(snapTo("  Consulting   POV ", PILLARS_LIST, "Behavioral Signal")).toBe("Consulting POV");
  });

  it("falls back rather than failing on something unrecognised", () => {
    expect(snapTo("Thought Leadership", PILLARS_LIST, "Behavioral Signal")).toBe("Behavioral Signal");
    expect(snapTo(undefined, PILLARS_LIST, "Behavioral Signal")).toBe("Behavioral Signal");
    expect(snapTo(42, PILLARS_LIST, "Behavioral Signal")).toBe("Behavioral Signal");
  });
});

describe("coercePlan keeps only what can safely be saved", () => {
  it("snaps every enum onto a value the app understands", () => {
    const { entries } = coercePlan(
      { items: [entry({ pillar: "Made Up Pillar", format: "Newsletter", channel: "Someone Else" })] },
      opts()
    );
    expect(PILLARS_LIST).toContain(entries[0].pillar);
    expect(ALL_CONTENT_TYPES).toContain(entries[0].format as never);
    expect(CHANNEL_IDS).toContain(entries[0].channel);
  });

  it("accepts the alternative field names a model might use", () => {
    const { entries } = coercePlan(
      { items: [{ day: 4, platform: "Harpreet", contentType: "Poll", pillar: "Human + AI", topic: "A question" }] },
      opts()
    );
    expect(entries[0].channel).toBe("Harpreet");
    expect(entries[0].format).toBe("Poll");
  });

  it("drops a day that does not exist in the month", () => {
    // September has 30 days; a 31st is not a fallback situation, it is unusable.
    const r = coercePlan({ items: [entry({ day: 31 }), entry({ day: 5 })] }, opts());
    expect(r.entries).toHaveLength(1);
    expect(r.skippedInvalid).toBe(1);
  });

  it("drops February 30th rather than rolling it into March", () => {
    const r = coercePlan({ items: [entry({ day: 30 }), entry({ day: 12 })] }, opts({ month: 1 }));
    expect(r.entries.map((e) => e.day)).toEqual([12]);
  });

  it("drops an entry with no topic, since there is nothing to fall back to", () => {
    const r = coercePlan({ items: [entry({ topic: "   " }), entry({ day: 9 })] }, opts());
    expect(r.entries).toHaveLength(1);
    expect(r.skippedInvalid).toBe(1);
  });

  it("rejects a day that is not a number", () => {
    const r = coercePlan({ items: [entry({ day: "soon" }), entry({ day: 2 })] }, opts());
    expect(r.entries.map((e) => e.day)).toEqual([2]);
  });

  it("clamps a very long topic instead of dropping it", () => {
    const { entries } = coercePlan({ items: [entry({ topic: "x".repeat(400) })] }, opts());
    expect(entries[0].topic.length).toBeLessThanOrEqual(110);
  });

  it("returns entries in date order, so planned callbacks land the right way round", () => {
    const r = coercePlan({ items: [entry({ day: 20 }), entry({ day: 4 }), entry({ day: 11 })] }, opts());
    expect(r.entries.map((e) => e.day)).toEqual([4, 11, 20]);
  });

  it("honours a maximum", () => {
    const items = Array.from({ length: 50 }, (_, i) => entry({ day: (i % 28) + 1 }));
    expect(coercePlan({ items }, opts({ max: 10 })).entries).toHaveLength(10);
  });
});

// The promise the whole feature rests on. The calendar has no undo, so a generated month
// must be incapable of writing over work that is already there.
describe("never writes onto a day that is already taken", () => {
  it("drops entries landing on an occupied date", () => {
    const r = coercePlan(
      { items: [entry({ day: 3 }), entry({ day: 4 }), entry({ day: 5 })] },
      opts({ occupied: new Set(["2026-09-03", "2026-09-05"]) })
    );
    expect(r.entries.map((e) => e.date)).toEqual(["2026-09-04"]);
    expect(r.skippedOccupied).toBe(2);
  });

  it("throws rather than silently producing nothing when every day is taken", () => {
    // Returning an empty month would look like the button did nothing at all.
    expect(() =>
      coercePlan({ items: [entry({ day: 3 })] }, opts({ occupied: new Set(["2026-09-03"]) }))
    ).toThrow(/no usable calendar entries/);
  });
});

describe("unusable responses fail loudly, never quietly", () => {
  it("throws on an empty items array", () => {
    expect(() => coercePlan({ items: [] }, opts())).toThrow(/no usable calendar entries/);
  });

  it("throws when items is missing or the wrong shape", () => {
    for (const bad of [{}, { items: "nope" }, { items: null }, null, undefined, "a string", 42]) {
      expect(() => coercePlan(bad, opts())).toThrow(/no usable calendar entries/);
    }
  });

  it("survives entries that are not objects", () => {
    const r = coercePlan({ items: [null, "text", 7, entry({ day: 6 })] }, opts());
    expect(r.entries).toHaveLength(1);
    expect(r.skippedInvalid).toBe(3);
  });
});

describe("toContentItems fills in what the model must not author", () => {
  const plan = coercePlan({ items: [entry({ day: 2 }), entry({ day: 8 })] }, opts());
  const items = toContentItems(plan, (i) => `gen_${i}`, "2026-09-01T00:00:00.000Z");

  it("sets status to Planned, matching every other creation path", () => {
    expect(items.every((i) => i.status === "Planned")).toBe(true);
  });

  it("never sets the legacy n, which would collide with the seeded plan", () => {
    // Seeded items are n = 1..36 and markDrafted matches on it, so reusing a number would
    // flip a different row's status.
    expect(items.every((i) => i.n === undefined)).toBe(true);
  });

  it("gives every item a distinct id", () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it("stamps both timestamps from the injected clock, not a live one", () => {
    expect(items.every((i) => i.createdAt === "2026-09-01T00:00:00.000Z")).toBe(true);
    expect(items.every((i) => i.updatedAt === i.createdAt)).toBe(true);
  });

  it("carries title and topic together, as the card and the Studio link expect", () => {
    expect(items[0].title).toBe(items[0].topic);
    expect(items[0].topic.length).toBeGreaterThan(0);
  });

  it("alternates the posting slot", () => {
    expect(items.map((i) => i.time)).toEqual(["10:30", "14:00"]);
  });
});

describe("occupiedDates", () => {
  const items = [
    { date: "2026-09-03" },
    { date: "2026-09-14" },
    { date: "2026-08-03" }, // a different month
    { date: "" } // an undated item
  ];

  it("collects only the month asked for", () => {
    const occ = occupiedDates(items, 2026, 8);
    expect(occ.has("2026-09-03")).toBe(true);
    expect(occ.has("2026-09-14")).toBe(true);
    expect(occ.has("2026-08-03")).toBe(false);
    expect(occ.size).toBe(2);
  });

  it("ignores items with no date rather than counting them", () => {
    expect(occupiedDates([{ date: "" }], 2026, 8).size).toBe(0);
  });

  it("pairs with coercePlan so a real month round-trips", () => {
    const occ = occupiedDates(items, 2026, 8);
    const r = coercePlan({ items: [entry({ day: 3 }), entry({ day: 4 })] }, opts({ occupied: occ }));
    expect(r.entries.map((e) => e.date)).toEqual(["2026-09-04"]);
  });
});
