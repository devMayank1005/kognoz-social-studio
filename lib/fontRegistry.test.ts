import { FONT_CATALOGUE } from "./fontCatalogue";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONTS, fontsUrlFor, slideFonts, slideFontsUrl, browserFontsUrl, chromeFonts,
  extraFonts,
  exportFontsUrl,
  familyOf,
  weightsFor,
  slideFontsUrl as slideFontsUrlAgain,
  facesFor,
  categoryFor,
  pickerFonts,
  EXTRA_FONTS
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

describe("the catalogue joins as opt-in extras", () => {
  it("never duplicates a family the registry already declares", () => {
    // Two entries for one family would emit it twice in a single css2 URL, which the API
    // rejects — and the brand's own axis must win, because that is what the export embeds.
    const declared = new Set(EXTRA_FONTS.map((f) => f.family));
    for (const f of FONTS) {
      if (f.uses.includes("extra")) continue;
      expect(declared.has(f.family), `${f.family} is both a brand font and an extra`).toBe(false);
    }
    const all = FONTS.map((f) => f.family);
    expect(new Set(all).size, "a family appears twice in FONTS").toBe(all.length);
  });

  it("brings the catalogue with it", () => {
    expect(EXTRA_FONTS.length).toBeGreaterThan(90);
    expect(EXTRA_FONTS.every((f) => f.uses.includes("extra"))).toBe(true);
  });

  it("leaves Open Sans, Poppins and Fraunces on the registry's own axis", () => {
    // All three are in the catalogue at MORE weights than the brands embed. Taking the
    // catalogue's axis would put weights in the picker the export never fetches.
    for (const family of ["Open Sans", "Poppins", "Fraunces"]) {
      const entry = FONTS.find((f) => f.family === family)!;
      expect(entry.uses.includes("extra"), family).toBe(false);
    }
    expect(facesFor("Open Sans").weights).toEqual([400, 600, 700, 800]);
  });
});

describe("facesFor", () => {
  it("reads a plain weight axis", () => {
    expect(facesFor("Poppins")).toEqual({ weights: [400, 500, 600, 700, 800], italics: [] });
  });

  it("does not mistake Fraunces's optical-size axis for an italic flag", () => {
    // `opsz,wght@9..144,400;...` — the first component is a size RANGE, not a 0/1 flag.
    // Reading it as one would report every weight as italic and none as upright.
    const f = facesFor("Fraunces");
    expect(f.weights).toEqual([400, 500, 600, 700]);
    expect(f.italics).toEqual([]);
  });

  it("splits uprights from italics on an ital axis", () => {
    const inter = facesFor("Inter");
    expect(inter.weights).toContain(400);
    expect(inter.weights).toContain(900);
    expect(inter.italics).toContain(400);
  });

  it("reports no italic for a family that has none", () => {
    expect(facesFor("Bebas Neue").italics).toEqual([]);
  });

  it("falls back rather than returning nothing for an unknown family", () => {
    expect(facesFor("Nonesuch").weights.length).toBeGreaterThan(0);
  });
});

describe("the no-synthesised-weight guarantee, for every family the picker offers", () => {
  // This is the invariant the whole file exists for, now checked across ~110 families
  // rather than asserted in a comment: a weight the toolbar offers must be a weight the
  // stylesheet actually requests.
  for (const brand of ["kognoz", "konverz"] as const) {
    it(`${brand}`, () => {
      for (const entry of pickerFonts(brand)) {
        const { weights, italics } = facesFor(entry.family);
        const url = fontsUrlFor([entry]);
        for (const w of weights) {
          expect(url, `${entry.family} offers upright ${w} but does not request it`).toContain(String(w));
        }
        if (italics.length) {
          expect(url, `${entry.family} offers italics but has no ital axis`).toContain("ital,wght@");
        }
      }
    });
  }
});

describe("categoryFor", () => {
  it("groups catalogue families by their real category", () => {
    expect(categoryFor("Playfair Display")).toBe("serif");
    expect(categoryFor("Roboto Mono")).toBe("mono");
    expect(categoryFor("Caveat")).toBe("handwriting");
  });

  it("does not throw on a family it has never heard of", () => {
    expect(categoryFor("Nonesuch")).toBe("sans");
  });
});

describe("pickerFonts", () => {
  it("offers the brand's own faces plus the catalogue, and no other brand's", () => {
    const kognoz = pickerFonts("kognoz").map((f) => f.family);
    expect(kognoz).toContain("Fraunces");
    expect(kognoz).not.toContain("Poppins");
    expect(kognoz.length).toBeGreaterThan(FONT_CATALOGUE.length - 5);
  });

  it("never offers a chrome-only face", () => {
    for (const brand of ["kognoz", "konverz"] as const) {
      const names = pickerFonts(brand).map((f) => f.family);
      expect(names).not.toContain("Plus Jakarta Sans");
    }
  });
});

describe("the export embeds only the faces a deck uses", () => {
  const stack = "'Montserrat', sans-serif";

  it("narrows an extra family to the weights it is used at", () => {
    // Montserrat serves 18 faces. A deck using one should not base64 the other seventeen
    // into every slide's SVG.
    const wide = exportFontsUrl("kognoz", [stack]);
    const narrow = exportFontsUrl("kognoz", [stack], new Map([[stack, { weights: [700], italics: [] }]]));
    expect(wide).toContain("Montserrat:");
    expect(narrow).toContain("family=Montserrat:wght@700");
    expect(narrow.length).toBeLessThan(wide.length);
  });

  it("keeps an italic when one is used", () => {
    const url = exportFontsUrl("kognoz", [stack], new Map([[stack, { weights: [400], italics: [400] }]]));
    expect(url).toContain("family=Montserrat:ital,wght@0,400;1,400");
  });

  it("refuses to ask for a face the family does not serve", () => {
    // css2 answers 400 for an unknown weight, and a 400 means the export embeds NOTHING —
    // every face falls back. Asking only for real faces is what keeps that impossible.
    const url = exportFontsUrl("kognoz", ["'Bebas Neue', sans-serif"], new Map([
      ["'Bebas Neue', sans-serif", { weights: [700, 900], italics: [400] }]
    ]));
    // Scoped to this family's own segment: the brand's Fraunces and Open Sans legitimately
    // carry 700, so asserting against the whole URL would pass for the wrong reason.
    const segment = url.split("&").find((part) => part.includes("Bebas+Neue")) ?? "";
    expect(segment).toBe("family=Bebas+Neue:wght@400");
  });

  it("leaves the brand's own faces at their full axis", () => {
    // Slide.tsx hardcodes weights in ~200 places that cannot be scanned, so narrowing a
    // brand font would drop a face the templates actually render.
    const url = exportFontsUrl("kognoz", [stack], new Map([[stack, { weights: [400], italics: [] }]]));
    expect(url).toContain("family=Open+Sans:wght@400;600;700;800");
    expect(url).toContain("family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700");
  });

  it("is still byte-identical for a deck that uses no extras", () => {
    for (const brand of ["kognoz", "konverz"] as const) {
      expect(exportFontsUrl(brand, [], new Map())).toBe(slideFontsUrl(brand));
    }
  });
});
