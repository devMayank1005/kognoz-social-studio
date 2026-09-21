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
/**
 * `extra` is the opt-in set.
 *
 * Deliberately NOT a slide use: slideFontsUrl(brandId) must keep producing the exact
 * strings it shipped with (a test pins them byte for byte), and every family in that URL
 * is base64-embedded into every export. An extra family is fetched only for a deck that
 * actually uses one.
 */
export type FontUse = "kognoz-slide" | "konverz-slide" | "chrome" | "extra";

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
/**
 * The curated extras offered in the canvas text picker.
 *
 * Appended after every existing entry on purpose: fontsUrlFor joins in array order, so
 * putting these last leaves slideFontsUrl(kognoz) and slideFontsUrl(konverz) byte-identical
 * to what shipped. Each axis lists only weights Google actually serves for that family —
 * offering one it does not is how you get a synthesised bold on screen and a different
 * weight in the downloaded file.
 */
export const EXTRA_FONTS: FontEntry[] = [
  { family: "Inter", axis: "wght@400;500;600;700;800", uses: ["extra"] },
  { family: "Montserrat", axis: "wght@400;500;600;700;800", uses: ["extra"] },
  { family: "Archivo", axis: "wght@400;500;600;700;800", uses: ["extra"] },
  { family: "Playfair Display", axis: "wght@400;500;600;700;800", uses: ["extra"] },
  { family: "Lora", axis: "wght@400;500;600;700", uses: ["extra"] },
  { family: "DM Sans", axis: "wght@400;500;700", uses: ["extra"] },
  { family: "Space Grotesk", axis: "wght@400;500;600;700", uses: ["extra"] },
  { family: "Bebas Neue", axis: "wght@400", uses: ["extra"] }
];

FONTS.push(...EXTRA_FONTS);

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
  // Extras are excluded: loading eight more families on every page load to serve the rare
  // deck that picks one is a cost every visit pays. They are injected when chosen instead.
  return fontsUrlFor(FONTS.filter((f) => !f.uses.includes("extra")));
}

/** Chrome families only. Exposed so a test can prove none of them reach an export. */
export function chromeFonts(): FontEntry[] {
  return FONTS.filter((f) => f.uses.includes("chrome"));
}

/** The opt-in families, offered beside the brand's own in the canvas text picker. */
export function extraFonts(): FontEntry[] {
  return FONTS.filter((f) => f.uses.includes("extra"));
}

/** "'Open Sans', system-ui, sans-serif" -> "Open Sans". */
export function familyOf(cssStack: string): string {
  return (cssStack.split(",")[0] || "").trim().replace(/^['"]|['"]$/g, "");
}

/**
 * The weights a family is actually served at.
 *
 * Parses the axis rather than assuming a ladder, because Fraunces is a variable font
 * addressed as `opsz,wght@9..144,400;9..144,500;...` — the weight is the last component of
 * each tuple, not the whole of it.
 */
export function weightsFor(family: string): number[] {
  const entry = FONTS.find((f) => f.family === family);
  if (!entry) return [400, 700];
  const spec = entry.axis.split("@")[1];
  if (!spec) return [400, 700];
  const out = new Set<number>();
  for (const tuple of spec.split(";")) {
    const last = tuple.split(",").pop() ?? "";
    const n = Number(last);
    if (Number.isFinite(n) && n >= 100 && n <= 900) out.add(n);
  }
  return out.size ? [...out].sort((a, b) => a - b) : [400, 700];
}

/**
 * The stylesheet an export embeds, widened to cover the families on the canvas.
 *
 * With no extra family in use this returns exactly slideFontsUrl(brandId), so an ordinary
 * deck's export is byte-for-byte what it was and costs nothing more to produce.
 */
export function exportFontsUrl(brandId: BrandId, usedFamilies: readonly string[]): string {
  const used = new Set(usedFamilies.map(familyOf));
  return fontsUrlFor(
    FONTS.filter((f) => f.uses.includes(SLIDE_USE[brandId]) || (f.uses.includes("extra") && used.has(f.family)))
  );
}
