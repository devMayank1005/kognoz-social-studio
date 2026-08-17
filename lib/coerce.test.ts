import { describe, it, expect } from "vitest";
import { structureBody, ensureEm, clampText, stripUrl, coerceContent, applyStatCardHygiene, applyIdeaDeckKickers } from "./coerce";

// PRD §16: "Unit-test set includes the two real-world failure strings from
// prototyping; both must pass forever." This is the first of the two, taken
// directly from the reference implementation's own regression history.
describe("structureBody — real failure case from prototyping", () => {
  it("splits claim / capability line / Source into exactly 3 lines, Source last", () => {
    const input =
      "Fewer than 1 in 3 fill critical roles through internal mobility. " +
      "Konverz AI's Talent Intelligence Layer surfaces hidden capability before roles go external. " +
      "Source: NASSCOM GCC Landscape Report, 2024";
    const out = structureBody(input);
    const lines = out.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Fewer than 1 in 3 fill critical roles through internal mobility.");
    expect(lines[1]).toBe("Konverz AI's Talent Intelligence Layer surfaces hidden capability before roles go external.");
    expect(lines[2]).toBe("Source: NASSCOM GCC Landscape Report, 2024");
  });
});

describe("ensureEm", () => {
  it("leaves text with an existing *word* untouched", () => {
    expect(ensureEm("Culture is what your people *do*")).toBe("Culture is what your people *do*");
  });
  it("marks the longest meaningful word when none is marked", () => {
    // "strategy" (8 letters) beats "Your", "people", "are" — matches the jsx
    // scoring rule (longest alphabetic run > 3 chars).
    expect(ensureEm("Your people are strategy")).toBe("Your people are *strategy*");
  });
});

describe("clampText", () => {
  it("clamps at a word boundary, not mid-word", () => {
    const long = "one two three four five six seven eight nine ten";
    const clamped = clampText(long, 20);
    expect(clamped.length).toBeLessThanOrEqual(20);
    expect(clamped.endsWith(" ")).toBe(false);
    expect(long.startsWith(clamped)).toBe(true);
  });
});

describe("stripUrl", () => {
  it("removes the site URL and bare https links, chrome only", () => {
    expect(stripUrl("Read more at kognozconsulting.com")).toBe("Read more");
    // Trailing-connector stripping only applies at the very end of the string,
    // so a mid-sentence URL just leaves the rest of the sentence intact.
    expect(stripUrl("See https://kognozconsulting.com/foo now")).toBe("See now");
  });
});

describe("coerceContent", () => {
  it("throws when the model returns no usable slides", () => {
    expect(() => coerceContent({ slides: [] })).toThrow("no slides");
  });
  it("caps at 8 slides by default, respects keepCount when given", () => {
    const nineSlides = Array.from({ length: 9 }, (_, i) => ({ title: `T${i}`, body: `B${i}` }));
    expect(coerceContent({ slides: nineSlides }).slides).toHaveLength(8);
    expect(coerceContent({ slides: nineSlides }, 3).slides).toHaveLength(3);
  });
});

describe("applyStatCardHygiene — PRD §16 named case", () => {
  it('splits "1,700+ GCCs. One critical gap" into figure title + remainder body', () => {
    const out = applyStatCardHygiene({ title: "1,700+ GCCs. One critical gap", body: "" });
    expect(out.title).toBe("1,700+ GCCs");
    expect(out.body.split("\n")[0]).toBe("One critical gap");
  });

  it("strips figure-echo when body opens with '<figure> of '", () => {
    const out = applyStatCardHygiene({ title: "30%", body: "30% of leaders miss this." });
    expect(out.body.startsWith("30%")).toBe(false);
    expect(out.body.startsWith("Leaders miss this")).toBe(true);
  });
});

describe("applyIdeaDeckKickers", () => {
  it("numbers Signal kickers sequentially, keeps Ask/Reveal literal", () => {
    const slides = [
      { title: "whatever", body: "a" },
      { title: "Ask something", body: "b" },
      { title: "Reveal something", body: "c" },
      { title: "another", body: "d" }
    ];
    const out = applyIdeaDeckKickers(slides, "signals");
    expect(out.map((s) => s.title)).toEqual(["Signal 01", "Ask", "Reveal", "Signal 02"]);
  });

  it("uses Idea NN + The Kognoz read for book style", () => {
    const slides = [
      { title: "x", body: "a" },
      { title: "Kognoz read on this", body: "b" }
    ];
    const out = applyIdeaDeckKickers(slides, "book");
    expect(out.map((s) => s.title)).toEqual(["Idea 01", "The Kognoz read"]);
  });

  it("leaves story-style kickers untouched", () => {
    const slides = [{ title: "Scene 01", body: "a" }];
    expect(applyIdeaDeckKickers(slides, "story")).toEqual(slides);
  });
});
