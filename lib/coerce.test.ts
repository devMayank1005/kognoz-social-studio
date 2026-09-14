import { describe, it, expect } from "vitest";
import { structureBody, ensureEm, clampText, stripUrl, coerceContent, applyStatCardHygiene, applyIdeaDeckKickers, applyFormatHygiene } from "./coerce";
import { budgetFor } from "./formats";

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

// ---------------------------------------------------------------------------
// The four formats the v4 reference added, and the two defaults they break.
// ---------------------------------------------------------------------------
describe("budgets for the v4 formats", () => {
  it("Customer Quote keeps a full quotation and does not invent emphasis", () => {
    // 40 words of somebody's published words. The 95-character default would cut
    // it mid-sentence, and ensureEm would mark a word inside it — which is a
    // misquote, not a design flourish.
    const quote =
      "We assessed HR business partners on behavioral and technical competencies, ran situational case studies, and built development plans from what the data showed rather than from what the panel remembered.";
    const out = coerceContent({ cover: quote, slides: [{ title: "Dr. Niza", body: "Head of Learning Strategy, Petronas" }] }, undefined, budgetFor("Customer Quote"));
    expect(out.cover).toBe(quote);
    expect(out.cover).not.toContain("*");
  });

  it("every other format still gets a gradient word forced in", () => {
    const out = coerceContent({ cover: "Screening to selection", slides: [{ title: "t", body: "b" }] }, undefined, budgetFor("Carousel"));
    expect(out.cover).toContain("*");
  });

  it("Numbers Wall splits a tile whose title ran past the figure", () => {
    // Same defect Stat Card has: the model writes the sentence into the figure.
    const out = applyFormatHygiene(
      coerceContent(
        { cover: "The four numbers", slides: [{ title: "60%. Time to hire", body: "Down from eleven weeks" }] },
        undefined,
        budgetFor("Numbers Wall")
      ),
      { format: "Numbers Wall" }
    );
    expect(out.slides[0].title).toBe("60%");
    expect(out.slides[0].body).toContain("Time to hire");
  });

  it("Feature Card keeps its \"-\" placeholder rows rather than dropping them", () => {
    const out = coerceContent(
      {
        cover: "Screening in under two minutes",
        slides: [
          { title: "-", body: "Screen AI reads the pile and ranks it before anyone opens a CV." },
          { title: "Valid and junk applications separated", body: "-" },
          { title: "Customizable grading per role", body: "-" },
          { title: "Pulls from LinkedIn, Naukri, ATS", body: "-" }
        ]
      },
      undefined,
      budgetFor("Feature Card")
    );
    // The renderer reads slides[1..3].title; a dropped row is a missing capability.
    expect(out.slides).toHaveLength(4);
    expect(out.slides[3].title).toContain("Naukri");
  });

  it("stripUrl removes both brand domains whichever brand wrote the line", () => {
    expect(stripUrl("Book a demo at konverz.ai")).toBe("Book a demo");
    expect(stripUrl("More at www.kognozconsulting.com")).toBe("More");
  });
});

describe("applyFormatHygiene", () => {
  const deck = { eyebrow: "", cover: "", cta: "", slides: [{ title: "the kognoz read", body: "b" }] };

  it("renames the Idea Deck closer to the brand's own, from either spelling", () => {
    expect(applyFormatHygiene(deck, { format: "Idea Deck", ideaStyle: "book", readCloser: "The Konverz read" }).slides[0].title).toBe(
      "The Konverz read"
    );
    const other = { ...deck, slides: [{ title: "The Konverz read", body: "b" }] };
    expect(applyFormatHygiene(other, { format: "Idea Deck", ideaStyle: "book" }).slides[0].title).toBe("The Kognoz read");
  });

  it("returns the same object when a format has no rules, so nothing re-renders", () => {
    const plain = { eyebrow: "", cover: "", cta: "", slides: [{ title: "t", body: "b" }] };
    expect(applyFormatHygiene(plain, { format: "Carousel" })).toBe(plain);
  });
});
