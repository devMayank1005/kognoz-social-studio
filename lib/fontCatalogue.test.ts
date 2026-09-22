import { describe, it, expect } from "vitest";
import {
  FONT_CATALOGUE,
  FONT_CATEGORIES,
  axisForFaces,
  catalogueEntry,
  hasFace,
  searchFonts,
  stackFor
} from "./fontCatalogue";

// The catalogue's job is to be TRUE, not merely present.
//
// lib/fontRegistry.ts exists because a family was once requested at a weight it does not
// serve: the browser synthesised it on screen, the export embedded a real file at a
// different weight, and the preview and the download disagreed with nothing saying so.
// Every assertion here is aimed at that failure returning through the catalogue.

describe("the catalogue is well formed", () => {
  it("is about the size we said, with unique families", () => {
    expect(FONT_CATALOGUE.length).toBeGreaterThanOrEqual(100);
    const names = FONT_CATALOGUE.map((e) => e.family);
    expect(new Set(names).size).toBe(names.length);
  });

  it("populates every category the picker renders", () => {
    for (const cat of FONT_CATEGORIES) {
      expect(FONT_CATALOGUE.some((e) => e.category === cat.id), `${cat.id} is empty`).toBe(true);
    }
  });

  it("gives every family at least one real upright weight", () => {
    for (const e of FONT_CATALOGUE) {
      expect(e.weights.length, e.family).toBeGreaterThan(0);
      for (const w of e.weights) {
        // 1–1000 is the CSS range, not 100–900. Nunito really is served at 1000, which is
        // the kind of thing generating from Google's own metadata gets right and writing
        // the list from memory would not.
        expect(Number.isInteger(w) && w >= 1 && w <= 1000, `${e.family} weight ${w}`).toBe(true);
      }
    }
  });

  it("keeps weights and italics sorted, because the css2 API rejects any other order", () => {
    for (const e of FONT_CATALOGUE) {
      expect(e.weights, e.family).toEqual([...e.weights].sort((a, b) => a - b));
      expect(e.italics, e.family).toEqual([...e.italics].sort((a, b) => a - b));
    }
  });
});

describe("the axis string agrees with the weight arrays", () => {
  // The arrays drive the toolbar; the axis string drives the URL. If they ever disagree,
  // the picker offers a face the stylesheet never fetched — the synthesised-weight bug.
  for (const e of FONT_CATALOGUE) {
    it(`${e.family}`, () => {
      if (e.italics.length) {
        expect(e.axis.startsWith("ital,wght@"), e.family).toBe(true);
        for (const w of e.weights) expect(e.axis).toContain(`0,${w}`);
        for (const w of e.italics) expect(e.axis).toContain(`1,${w}`);
      } else {
        expect(e.axis, e.family).toBe(`wght@${e.weights.join(";")}`);
        expect(e.axis).not.toContain("ital");
      }
    });
  }
});

describe("hasFace", () => {
  it("knows a real face from one the browser would fake", () => {
    // Inter serves 100-900 upright and italic; Bebas Neue serves exactly one face.
    expect(hasFace("Inter", 700, false)).toBe(true);
    expect(hasFace("Inter", 700, true)).toBe(true);
    expect(hasFace("Bebas Neue", 400, false)).toBe(true);
    expect(hasFace("Bebas Neue", 700, false)).toBe(false);
    expect(hasFace("Bebas Neue", 400, true)).toBe(false);
  });

  it("says no for a family it does not have", () => {
    expect(hasFace("Comic Sans MS", 400, false)).toBe(false);
  });
});

describe("axisForFaces", () => {
  it("asks for only the faces given, which is what keeps an export small", () => {
    expect(axisForFaces([400], [])).toBe("wght@400");
    expect(axisForFaces([700, 400], [])).toBe("wght@400;700");
  });

  it("puts uprights before italics, the only order the API accepts", () => {
    expect(axisForFaces([400, 700], [400])).toBe("ital,wght@0,400;0,700;1,400");
  });

  it("still names an upright when only an italic is used", () => {
    // `ital,wght@1,400` alone is a 400 from the API, and a 400 means no font in the export.
    expect(axisForFaces([], [400])).toBe("ital,wght@0,400;1,400");
  });

  it("de-duplicates rather than repeating a weight", () => {
    expect(axisForFaces([400, 400, 700], [400, 400])).toBe("ital,wght@0,400;0,700;1,400");
  });

  it("returns nothing when nothing is used", () => {
    expect(axisForFaces([], [])).toBe("");
  });
});

describe("searchFonts", () => {
  it("returns everything for an empty query", () => {
    expect(searchFonts("")).toHaveLength(FONT_CATALOGUE.length);
  });

  it("matches a family name, case-insensitively", () => {
    expect(searchFonts("playfair").map((e) => e.family)).toContain("Playfair Display");
  });

  it("narrows to a category", () => {
    const mono = searchFonts("", "mono");
    expect(mono.length).toBeGreaterThan(0);
    expect(mono.every((e) => e.category === "mono")).toBe(true);
  });

  it("combines a query with a category", () => {
    expect(searchFonts("mono", "sans")).toHaveLength(0);
    expect(searchFonts("roboto", "mono").map((e) => e.family)).toEqual(["Roboto Mono"]);
  });
});

describe("stackFor", () => {
  it("single-quotes the family so the stack can live in a double-quoted style attribute", () => {
    // lib/richText.ts documents why: sanitiseHtml reads style="..." with a regex that stops
    // at the delimiting quote, so a double quote inside truncates it silently.
    for (const e of FONT_CATALOGUE) {
      expect(stackFor(e), e.family).not.toContain('"');
    }
  });

  it("falls back to the right generic for the category", () => {
    expect(stackFor(catalogueEntry("Lora")!)).toBe("'Lora', serif");
    expect(stackFor(catalogueEntry("Inter")!)).toBe("'Inter', sans-serif");
    expect(stackFor(catalogueEntry("Roboto Mono")!)).toBe("'Roboto Mono', monospace");
    expect(stackFor(catalogueEntry("Caveat")!)).toBe("'Caveat', cursive");
  });
});
