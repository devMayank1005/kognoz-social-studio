// Every font this app loads, and where each one is allowed to go.
//
// There were three hand-maintained Google Fonts URLs before this: GOOGLE_FONTS_URL and
// KONVERZ_GOOGLE_FONTS_URL in lib/tokens.ts (which lib/exportFonts.ts fetches and
// base64-embeds into every exported SVG), and a third hardcoded string in
// app/layout.tsx for the browser. Nothing kept them in step, and they had already
// drifted: the browser loaded Open Sans at 400/600/700 while a slide renderer uses
// weight 800 (components/Slide.tsx:1486), so that title was a SYNTHESISED bold on
// screen and a TRUE 800 in the export. Preview and export disagreed and nothing said so.
//
// Two rules make that class of bug impossible:
//
//   1. A `chrome` font is NEVER embedded in an export. lib/exportFonts.ts inlines every
//      face in the URL it is given as base64; putting the UI's faces in there would add
//      two families nothing on a slide uses to the weight of every PNG and PDF.
//   2. A `slide` font is requested from the browser at EXACTLY the weights the export
//      embeds. Anything else is the drift above.
//
// Pure and I/O-free so both rules are testable without a network.

import type { BrandId } from "./brands";

/** Where a family is allowed to appear. */
export type FontUse = "kognoz-slide" | "konverz-slide" | "chrome";

export interface FontEntry {
  /** Family name exactly as the css2 API spells it; spaces become "+" in the URL. */
  family: string;
  /**
   * The axis spec that follows the colon in a css2 URL.
   *
   * Kept verbatim rather than generated from a weight list: Fraunces is a variable
   * font addressed through an `opsz,wght` range, and rewriting that into a
   * simple weight list would change the bytes Google serves.
   */
  axis: string;
  uses: FontUse[];
}

/**
 * The registry.
 *
 * Order matters and is load-bearing: the css2 URL is built by joining these in
 * sequence, and the export URLs must come out byte-identical to the strings that
 * shipped, or every exported PDF changes. A test pins exactly that.
 */
export const FONTS: FontEntry[] = [
  {
    family: "Fraunces",
    axis: "opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700",
    uses: ["kognoz-slide"]
  },
  {
    family: "Open Sans",
    axis: "wght@400;600;700;800",
    uses: ["kognoz-slide"]
  },
  {
    family: "Poppins",
    axis: "wght@400;500;600;700;800",
    uses: ["konverz-slide"]
  },
  // ---- chrome only, from here down. Never embedded in an export. ----
  {
    // PRD §2.1 — the UI face. Only ever applied to the shell, never to a slide.
    family: "Plus Jakarta Sans",
    axis: "wght@400;500;600;700",
    uses: ["chrome"]
  },
  {
    // PRD §2.1 — metrics, timestamps and IDs, for its tabular numerals.
    family: "JetBrains Mono",
    axis: "wght@400;500;700",
    uses: ["chrome"]
  }
];

const BASE = "https://fonts.googleapis.com/css2";
const SUFFIX = "&display=swap";

/** One css2 stylesheet URL for the given families, in registry order. */
export function fontsUrlFor(entries: FontEntry[]): string {
  if (!entries.length) return "";
  const families = entries.map((e) => `family=${e.family.replace(/ /g, "+")}:${e.axis}`).join("&");
  return `${BASE}?${families}${SUFFIX}`;
}

const SLIDE_USE: Record<BrandId, FontUse> = {
  kognoz: "kognoz-slide",
  konverz: "konverz-slide"
};

/** The families that appear on a brand's slides. */
export function slideFonts(brandId: BrandId): FontEntry[] {
  return FONTS.filter((f) => f.uses.includes(SLIDE_USE[brandId]));
}

/**
 * The stylesheet an export embeds for this brand.
 *
 * This is the string lib/exportFonts.ts fetches and turns into base64 @font-face
 * rules inside the exported SVG. It must contain slide faces and nothing else.
 */
export function slideFontsUrl(brandId: BrandId): string {
  return fontsUrlFor(slideFonts(brandId));
}

/**
 * The stylesheet the browser loads.
 *
 * Every slide family — both brands render in one session, and swapping a <link> on a
 * brand change reflows the whole page — plus the chrome faces. Slide families are
 * requested at the same weights the export embeds, so what you see is what you get.
 */
export function browserFontsUrl(): string {
  return fontsUrlFor(FONTS);
}

/** Chrome families only. Exposed so a test can prove none of them reach an export. */
export function chromeFonts(): FontEntry[] {
  return FONTS.filter((f) => f.uses.includes("chrome"));
}
