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
import { FONT_CATALOGUE, axisForFaces, catalogueEntry, type FontCategory } from "./fontCatalogue";

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
export const EXTRA_FONTS: FontEntry[] = FONT_CATALOGUE
  // A family the registry already declares keeps ITS axis, not the catalogue's. Open Sans,
  // Poppins and Fraunces are brand slide fonts embedded at specific weights; the catalogue
  // knows they are served at more than that, and offering the extra ones would put a weight
  // in the picker that the brand's export URL never fetches — the synthesised-weight bug,
  // reintroduced through the back door. Duplicating the family would also emit it twice in
  // one css2 URL, which the API rejects outright.
  .filter((c) => !FONTS.some((f) => f.family === c.family))
  .map((c) => ({ family: c.family, axis: c.axis, uses: ["extra"] as FontUse[] }));

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
    // 1–1000, not 100–900: Nunito and three others really are served at 1000, and clamping
    // them out would hide a face the stylesheet does fetch.
    if (Number.isFinite(n) && n >= 1 && n <= 1000) out.add(n);
  }
  return out.size ? [...out].sort((a, b) => a - b) : [400, 700];
}

/**
 * The stylesheet an export embeds, widened to cover the families on the canvas.
 *
 * With no extra family in use this returns exactly slideFontsUrl(brandId), so an ordinary
 * deck's export is byte-for-byte what it was and costs nothing more to produce.
 */
export function exportFontsUrl(
  brandId: BrandId,
  usedFamilies: readonly string[],
  /**
   * The faces each family is actually used at, keyed by the CSS stack as stored.
   *
   * Optional, and only ever narrows an `extra`. A brand's own slide fonts keep their full
   * axis on purpose: components/Slide.tsx hardcodes weights in around two hundred places
   * that cannot be scanned, and the two byte-pinned URLs must stay byte-identical.
   */
  usedFaces?: ReadonlyMap<string, { weights: number[]; italics: number[] }>
): string {
  const used = new Set(usedFamilies.map(familyOf));

  // Collapse the face map onto plain family names — it is keyed by CSS stack, which carries
  // quoting and fallbacks the registry does not.
  const facesByFamily = new Map<string, { weights: number[]; italics: number[] }>();
  for (const [stack, faces] of usedFaces ?? []) {
    const family = familyOf(stack);
    const prev = facesByFamily.get(family);
    facesByFamily.set(
      family,
      prev
        ? {
            weights: [...new Set([...prev.weights, ...faces.weights])],
            italics: [...new Set([...prev.italics, ...faces.italics])]
          }
        : faces
    );
  }

  const entries = FONTS.filter(
    (f) => f.uses.includes(SLIDE_USE[brandId]) || (f.uses.includes("extra") && used.has(f.family))
  ).map((f) => {
    if (!f.uses.includes("extra")) return f;
    const wanted = facesByFamily.get(f.family);
    if (!wanted) return f;
    const real = facesFor(f.family);
    // Only faces the family genuinely serves — asking css2 for one it does not is a 400,
    // and a 400 means the export embeds nothing at all.
    const weights = wanted.weights.filter((w) => real.weights.includes(w));
    const italics = wanted.italics.filter((w) => real.italics.includes(w));
    const axis = axisForFaces(weights.length ? weights : real.weights.slice(0, 1), italics);
    return axis ? { ...f, axis } : f;
  });

  return fontsUrlFor(entries);
}

/**
 * The real faces a family serves, split into uprights and italics.
 *
 * Parsed from the SAME axis string the URL is built from, so the toolbar cannot offer a face
 * the stylesheet does not fetch. That is the whole invariant of this file, extended to
 * italics: a family with no `ital` axis returns an empty italic list, and the toolbar
 * disables the button rather than letting the browser oblique it.
 */
export function facesFor(family: string): { weights: number[]; italics: number[] } {
  const entry = FONTS.find((f) => f.family === family);
  if (!entry) return { weights: [400, 700], italics: [] };
  const spec = entry.axis.split("@")[1] ?? "";
  const weights = new Set<number>();
  const italics = new Set<number>();
  const hasItal = entry.axis.startsWith("ital,");
  for (const tuple of spec.split(";")) {
    const parts = tuple.split(",");
    const n = Number(parts[parts.length - 1]);
    if (!Number.isFinite(n) || n < 1 || n > 1000) continue;
    // With an `ital` axis the first component is the 0/1 flag. Without one, every tuple is
    // upright — including Fraunces's `opsz,wght@9..144,400`, whose first component is a size
    // range and must not be read as an italic flag.
    if (hasItal && parts[0].trim() === "1") italics.add(n);
    else weights.add(n);
  }
  return {
    weights: weights.size ? [...weights].sort((a, b) => a - b) : [400],
    italics: [...italics].sort((a, b) => a - b)
  };
}

/** What kind of face this is, for grouping the picker. Registry-only families are sans. */
export function categoryFor(family: string): FontCategory {
  return catalogueEntry(family)?.category ?? "sans";
}

/** Every family the picker may offer for this brand: its slide faces, then the catalogue. */
export function pickerFonts(brandId: BrandId): FontEntry[] {
  return [...slideFonts(brandId), ...extraFonts()];
}
