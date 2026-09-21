import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONTS, fontsUrlFor, slideFonts, slideFontsUrl, browserFontsUrl, chromeFonts,
  extraFonts,
  exportFontsUrl,
  familyOf,
  weightsFor,
  slideFontsUrl as slideFontsUrlAgain
} from "./fontRegistry";
import { BRAND_IDS } from "./brands";

// Two properties matter here, and both are expensive to get wrong in ways nobody
// notices until a file is already published.

// ---------------------------------------------------------------------------
// 1. The export stylesheets must not change.
//
// lib/exportFonts.ts fetches these and base64-embeds every face into the exported
// SVG. A different URL means different embedded bytes in every PNG and PDF — so the
// exact strings that shipped are pinned here, character for character.
// ---------------------------------------------------------------------------
const SHIPPED_KOGNOZ =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Open+Sans:wght@400;600;700;800&display=swap";
const SHIPPED_KONVERZ =
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap";

describe("the export stylesheets are byte-identical to what shipped", () => {
  it("kognoz", () => {
    expect(slideFontsUrl("kognoz")).toBe(SHIPPED_KOGNOZ);
  });

  it("konverz", () => {
    expect(slideFontsUrl("konverz")).toBe(SHIPPED_KONVERZ);
  });

  it("still matches the constants the rest of the app imports", () => {
    // tokens.ts derives from this registry now. If that wiring is ever cut, this
    // catches it before an export silently loses a typeface.
    const tokens = readFileSync(join(__dirname, "tokens.ts"), "utf8");
    expect(tokens).toContain("slideFontsUrl");
  });
});

// ---------------------------------------------------------------------------
// 2. A chrome font must never reach an export.
// ---------------------------------------------------------------------------
describe("chrome faces stay out of the export path", () => {
  it("the UI families are not in either brand's export stylesheet", () => {
    // Otherwise every PNG and PDF carries two families no slide ever uses.
    for (const brand of BRAND_IDS) {
      const url = slideFontsUrl(brand);
      for (const entry of chromeFonts()) {
        expect(url).not.toContain(entry.family.replace(/ /g, "+"));
      }
    }
  });

  it("no family is tagged both chrome and slide", () => {
    for (const f of FONTS) {
      const isChrome = f.uses.includes("chrome");
      const isSlide = f.uses.some((u) => u.endsWith("-slide"));
      expect(isChrome && isSlide).toBe(false);
    }
  });

  it("names the two the PRD asks for", () => {
    const names = chromeFonts().map((f) => f.family);
    expect(names).toContain("Plus Jakarta Sans");
    expect(names).toContain("JetBrains Mono");
  });
});

// ---------------------------------------------------------------------------
// 3. The browser must request slide faces at the weights the export embeds.
//
// This is the bug that already shipped: the browser loaded Open Sans at 400/600/700
// while Slide.tsx:1486 renders a title at weight 800, so it was a synthesised bold on
// screen and a true 800 in the file. Preview and export disagreed silently.
// ---------------------------------------------------------------------------
describe("preview matches export", () => {
  const browser = browserFontsUrl();

  it("requests every slide family the exports embed", () => {
    for (const brand of BRAND_IDS) {
      for (const entry of slideFonts(brand)) {
        expect(browser).toContain(`family=${entry.family.replace(/ /g, "+")}:${entry.axis}`);
      }
    }
  });

  it("requests them at exactly the export's weights, not a lighter subset", () => {
    // The specific regression: Open Sans without 800.
    expect(browser).toContain("family=Open+Sans:wght@400;600;700;800");
  });

  it("also loads the chrome families", () => {
    expect(browser).toContain("family=Plus+Jakarta+Sans:");
    expect(browser).toContain("family=JetBrains+Mono:");
  });

  it("is a single stylesheet request", () => {
    expect(browser.startsWith("https://fonts.googleapis.com/css2?")).toBe(true);
    expect(browser.split("?").length).toBe(2);
    expect(browser.endsWith("&display=swap")).toBe(true);
  });
});

describe("fontsUrlFor", () => {
  it("encodes spaces the way the css2 API expects", () => {
    expect(fontsUrlFor([{ family: "Plus Jakarta Sans", axis: "wght@400", uses: ["chrome"] }])).toContain(
      "family=Plus+Jakarta+Sans:wght@400"
    );
  });

  it("joins several families with &", () => {
    const url = fontsUrlFor([
      { family: "A", axis: "wght@400", uses: ["chrome"] },
      { family: "B", axis: "wght@700", uses: ["chrome"] }
    ]);
    expect(url).toBe("https://fonts.googleapis.com/css2?family=A:wght@400&family=B:wght@700&display=swap");
  });

  it("returns empty rather than a malformed URL for no families", () => {
    // A request for "?&display=swap" would 400, and the export would silently lose
    // every typeface with no error anyone sees.
    expect(fontsUrlFor([])).toBe("");
  });
});

describe("the registry itself", () => {
  it("has no duplicate families", () => {
    const names = FONTS.map((f) => f.family);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every entry a use, so nothing is loaded for no reason", () => {
    for (const f of FONTS) expect(f.uses.length).toBeGreaterThan(0);
  });

  it("gives every brand at least one slide family", () => {
    for (const brand of BRAND_IDS) expect(slideFonts(brand).length).toBeGreaterThan(0);
  });
});

describe("the opt-in extra families", () => {
  it("never widen a brand's export URL on their own", () => {
    // The whole point of the separate use tag: a deck that picks none of them must produce
    // exactly the stylesheet that shipped, byte for byte, and embed exactly what it did.
    for (const brand of ["kognoz", "konverz"] as const) {
      expect(exportFontsUrl(brand, [])).toBe(slideFontsUrlAgain(brand));
      expect(exportFontsUrl(brand, ["'Open Sans', sans-serif"])).toBe(slideFontsUrlAgain(brand));
    }
  });

  it("are added to the export URL only when the canvas uses them", () => {
    const url = exportFontsUrl("kognoz", ["'Bebas Neue', sans-serif"]);
    expect(url).toContain("family=Bebas+Neue");
    expect(url).toContain("family=Fraunces");
    expect(url).not.toContain("family=Inter");
  });

  it("stay out of the stylesheet every page load fetches", () => {
    const browser = browserFontsUrl();
    for (const f of extraFonts()) expect(browser).not.toContain(`family=${f.family.replace(/ /g, "+")}`);
  });

  it("are never also a slide or chrome family", () => {
    for (const f of extraFonts()) expect(f.uses).toEqual(["extra"]);
  });
});

describe("familyOf and weightsFor", () => {
  it("reads the family name out of a CSS stack", () => {
    expect(familyOf("'Open Sans', system-ui, sans-serif")).toBe("Open Sans");
    expect(familyOf('"Bebas Neue", sans-serif')).toBe("Bebas Neue");
    expect(familyOf("Inter")).toBe("Inter");
  });

  it("reads weights off a plain wght axis", () => {
    expect(weightsFor("Open Sans")).toEqual([400, 600, 700, 800]);
    expect(weightsFor("Bebas Neue")).toEqual([400]);
  });

  it("reads weights off a variable font's two-axis spec", () => {
    // Fraunces is "opsz,wght@9..144,400;9..144,500;..." — the weight is the last component
    // of each tuple. Taking the whole tuple would offer nonsense weights in the picker.
    expect(weightsFor("Fraunces")).toEqual([400, 500, 600, 700]);
  });

  it("falls back rather than throwing on a family it has never heard of", () => {
    expect(weightsFor("Comic Papyrus")).toEqual([400, 700]);
  });
});
