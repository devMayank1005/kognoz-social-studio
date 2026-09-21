import { describe, it, expect } from "vitest";
import {
  channelTallies,
  pickedIds,
  contributors,
  filterSamples,
  rejectionReason,
  corpusState
} from "./voiceGuide";
import { MIN_SAMPLE_CHARS, DEFAULT_SAMPLE_COUNT, type VoiceSample } from "./voiceSamples";

let n = 0;
const sample = (over: Partial<VoiceSample> = {}): VoiceSample => ({
  id: `vs_${++n}`,
  channel: "Lokesh",
  kind: "post",
  // Long enough to be a valid sample; the length rule is tested directly below.
  text: "x".repeat(MIN_SAMPLE_CHARS + 20),
  addedAt: "2026-09-21T00:00:00.000Z",
  ...over
});

describe("a contributor can see whether their sample is used", () => {
  it("reports totals and how many of each channel get picked", () => {
    const samples = [
      ...Array.from({ length: 3 }, () => sample({ channel: "Lokesh" })),
      ...Array.from({ length: 2 }, () => sample({ channel: "Harpreet" }))
    ];
    const tallies = channelTallies(samples);
    expect(tallies.find((t) => t.channel === "Lokesh")?.total).toBe(3);
    expect(tallies.find((t) => t.channel === "Harpreet")?.total).toBe(2);
    for (const t of tallies) expect(t.picked).toBeGreaterThan(0);
  });

  it("shows that not everything is picked once a channel is oversubscribed", () => {
    // The whole reason this module exists: add twenty, and a generation still draws on
    // about eight. Without surfacing that, people assume every sample is in play.
    const samples = Array.from({ length: DEFAULT_SAMPLE_COUNT + 12 }, () => sample({ channel: "Lokesh" }));
    const t = channelTallies(samples)[0];
    expect(t.total).toBe(DEFAULT_SAMPLE_COUNT + 12);
    expect(t.picked).toBeLessThan(t.total);
  });

  it("lists only channels that actually have samples", () => {
    // A founder shown as "0 / 0" reads as a broken row, not as an absence.
    expect(channelTallies([sample({ channel: "Lokesh" })]).map((t) => t.channel)).toEqual(["Lokesh"]);
  });

  it("orders by size so the thin channels are visible at the bottom", () => {
    const samples = [sample({ channel: "Harpreet" }), ...Array.from({ length: 4 }, () => sample({ channel: "Lokesh" }))];
    expect(channelTallies(samples).map((t) => t.channel)).toEqual(["Lokesh", "Harpreet"]);
  });

  it("marks the ids a generation would draw on", () => {
    const samples = Array.from({ length: 4 }, () => sample({ channel: "Lokesh" }));
    const ids = pickedIds(samples);
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) expect(samples.some((s) => s.id === id)).toBe(true);
  });

  it("covers every channel, not just the first", () => {
    const l = sample({ channel: "Lokesh" });
    const h = sample({ channel: "Harpreet" });
    const ids = pickedIds([l, h]);
    expect(ids.has(l.id)).toBe(true);
    expect(ids.has(h.id)).toBe(true);
  });

  it("handles an empty corpus", () => {
    expect(channelTallies([])).toEqual([]);
    expect(pickedIds([]).size).toBe(0);
  });
});

describe("contributors", () => {
  it("counts who added what, most first", () => {
    const samples = [
      sample({ addedBy: "lokesh@kognozconsulting.com" }),
      sample({ addedBy: "yashwanth@kognozconsulting.com" }),
      sample({ addedBy: "yashwanth@kognozconsulting.com" })
    ];
    expect(contributors(samples)).toEqual([
      { who: "yashwanth@kognozconsulting.com", count: 2 },
      { who: "lokesh@kognozconsulting.com", count: 1 }
    ]);
  });

  it("does not attribute unattributed samples to anyone", () => {
    // Seeded samples from the editorial plan have no contributor. Assigning them to
    // whoever is looking would be a small, quiet lie about who did the work.
    const out = contributors([sample({ addedBy: undefined }), sample({ addedBy: "   " })]);
    expect(out).toHaveLength(1);
    expect(out[0].who).toMatch(/before contributors were recorded/i);
    expect(out[0].count).toBe(2);
  });
});

describe("filterSamples", () => {
  const samples = [
    sample({ channel: "Lokesh", kind: "post" }),
    sample({ channel: "Lokesh", kind: "article" }),
    sample({ channel: "Harpreet", kind: "post" })
  ];

  it("filters by channel, by kind, and by both", () => {
    expect(filterSamples(samples, { channel: "Lokesh" })).toHaveLength(2);
    expect(filterSamples(samples, { kind: "post" })).toHaveLength(2);
    expect(filterSamples(samples, { channel: "Lokesh", kind: "post" })).toHaveLength(1);
  });

  it("returns everything when nothing is selected", () => {
    expect(filterSamples(samples, {})).toHaveLength(3);
  });
});

describe("a refused paste says why", () => {
  it("accepts a sample of real length", () => {
    expect(rejectionReason("y".repeat(MIN_SAMPLE_CHARS))).toBeNull();
  });

  it("explains a short one, with how short", () => {
    // A paste that silently vanishes is the failure mode: the person believes it saved.
    const reason = rejectionReason("y".repeat(MIN_SAMPLE_CHARS - 10));
    expect(reason).toContain("10 characters");
    expect(reason).toContain(String(MIN_SAMPLE_CHARS));
  });

  it("gets the singular right, because '1 characters' looks broken", () => {
    expect(rejectionReason("y".repeat(MIN_SAMPLE_CHARS - 1))).toContain("1 character.");
  });

  it("names an empty box as empty rather than as too short", () => {
    for (const empty of ["", "   ", "\n\n"]) {
      expect(rejectionReason(empty)).toMatch(/empty/i);
    }
  });

  it("ignores surrounding whitespace when measuring", () => {
    expect(rejectionReason("  " + "y".repeat(MIN_SAMPLE_CHARS) + "  ")).toBeNull();
  });
});

describe("empty and unreadable never look alike", () => {
  it("warns that a save could overwrite when the corpus could not be read", () => {
    // This is the dangerous one: the samples may exist, and writing now destroys them.
    const s = corpusState([], true, "Kognoz");
    expect(s.kind).toBe("unreachable");
    expect(s.message).toMatch(/could not read/i);
    expect(s.message).toMatch(/overwriting/i);
  });

  it("treats unreadable as unreadable even when samples were cached", () => {
    expect(corpusState([sample()], true, "Kognoz").kind).toBe("unreachable");
  });

  it("invites a first sample when the corpus is genuinely empty", () => {
    const s = corpusState([], false, "Konverz AI");
    expect(s.kind).toBe("empty");
    expect(s.message).toContain("Konverz AI");
    expect(s.message).toMatch(/no human writing to imitate/i);
    expect(s.message).not.toMatch(/overwrit/i);
  });

  it("states the count and how many get drawn on when ready", () => {
    const s = corpusState([sample(), sample()], false, "Kognoz");
    expect(s.kind).toBe("ready");
    expect(s.message).toContain("2 samples");
    expect(s.message).toContain(String(DEFAULT_SAMPLE_COUNT));
  });

  it("says '1 sample', not '1 samples'", () => {
    expect(corpusState([sample()], false, "Kognoz").message).toContain("1 sample.");
  });
});
