import { describe, it, expect } from "vitest";
import { coerceClaims, summarise, sortClaims, summaryLine, type Claim } from "./verifyClaims";

const claim = (over: Partial<Claim> = {}): Claim => ({
  where: "slide 2",
  claim: "Attrition fell 14% after the redesign",
  verdict: "verified",
  note: "Matches the 2026 report.",
  realSource: "Some Report 2026",
  ...over
});

// The whole reason this module exists: a fact-check that blurs "we could not confirm
// this" into "this is false" makes someone delete a true sentence. These tests are
// mostly about keeping those two apart.

describe("unverifiable is not wrong", () => {
  it("counts them separately", () => {
    const s = summarise([
      claim({ verdict: "verified" }),
      claim({ verdict: "unverifiable" }),
      claim({ verdict: "unverifiable" }),
      claim({ verdict: "wrong" })
    ]);
    expect(s).toMatchObject({ total: 4, verified: 1, unverifiable: 2, wrong: 1 });
  });

  it("only a contradiction demands attention", () => {
    expect(summarise([claim({ verdict: "unverifiable" })]).needsAttention).toBe(false);
    expect(summarise([claim({ verdict: "wrong" })]).needsAttention).toBe(true);
  });

  it("never reports 'all confirmed' when something was merely unconfirmed", () => {
    const line = summaryLine(summarise([claim({ verdict: "verified" }), claim({ verdict: "unverifiable" })]));
    expect(line).not.toMatch(/all .* confirmed/i);
    expect(line).toMatch(/could not be confirmed/i);
  });

  it("says plainly when something is contradicted", () => {
    expect(summaryLine(summarise([claim({ verdict: "wrong" })]))).toMatch(/contradicted/i);
  });

  it("reports a clean pass only when every claim was actually confirmed", () => {
    expect(summaryLine(summarise([claim(), claim()]))).toBe("All 2 claims confirmed.");
    expect(summaryLine(summarise([claim()]))).toBe("All 1 claim confirmed.");
  });

  it("handles an empty result without claiming success", () => {
    const s = summarise([]);
    expect(s.total).toBe(0);
    expect(s.needsAttention).toBe(false);
    expect(summaryLine(s)).toBe("Nothing to check yet.");
  });
});

describe("coerceClaims", () => {
  it("reads a well-formed verdict", () => {
    const [c] = coerceClaims([
      { where: "cover", claim: "A claim", verdict: "wrong", note: "The figure is 9%.", realSource: "Report 2026" }
    ]);
    expect(c).toEqual({
      where: "cover",
      claim: "A claim",
      verdict: "wrong",
      note: "The figure is 9%.",
      realSource: "Report 2026"
    });
  });

  it("falls back to unverifiable for an unrecognised verdict", () => {
    // The conservative direction. Guessing "verified" waves a bad number through;
    // guessing "wrong" flags a good one.
    for (const v of ["maybe", "", null, 7, "VERIFIED_ISH"]) {
      expect(coerceClaims([{ claim: "x", verdict: v }])[0].verdict).toBe("unverifiable");
    }
  });

  it("accepts a verdict in any casing", () => {
    expect(coerceClaims([{ claim: "x", verdict: "Wrong" }])[0].verdict).toBe("wrong");
  });

  it("drops a row with no claim text, which nobody could act on", () => {
    expect(coerceClaims([{ claim: "   ", verdict: "wrong" }, { claim: "real", verdict: "verified" }])).toHaveLength(1);
  });

  it("survives a reply that is not a list at all", () => {
    for (const bad of [null, undefined, {}, "text", 42]) expect(coerceClaims(bad)).toEqual([]);
  });

  it("survives entries that are not objects", () => {
    expect(coerceClaims([null, "nope", 3, { claim: "real", verdict: "verified" }])).toHaveLength(1);
  });

  it("names a location rather than leaving it blank", () => {
    expect(coerceClaims([{ claim: "x", verdict: "verified" }])[0].where).toBe("somewhere in this deck");
  });

  it("uses null, not an empty string, for a missing source", () => {
    expect(coerceClaims([{ claim: "x", verdict: "verified" }])[0].realSource).toBeNull();
  });
});

describe("sortClaims", () => {
  it("puts contradictions first and confirmations last", () => {
    // A list opening on ten green ticks buries the one row that needed reading.
    const sorted = sortClaims([
      claim({ verdict: "verified", claim: "a" }),
      claim({ verdict: "unverifiable", claim: "b" }),
      claim({ verdict: "wrong", claim: "c" })
    ]);
    expect(sorted.map((c) => c.verdict)).toEqual(["wrong", "unverifiable", "verified"]);
  });

  it("does not mutate the input", () => {
    const input = [claim({ verdict: "verified" }), claim({ verdict: "wrong" })];
    sortClaims(input);
    expect(input[0].verdict).toBe("verified");
  });

  it("keeps the original order within a verdict", () => {
    const sorted = sortClaims([
      claim({ verdict: "wrong", claim: "first" }),
      claim({ verdict: "wrong", claim: "second" })
    ]);
    expect(sorted.map((c) => c.claim)).toEqual(["first", "second"]);
  });
});
