import type { BrandId } from "@/lib/brands";
import { C } from "@/lib/tokens";

// The small amount of brand-dependent chrome that is NOT colour.
//
// Colour used to live here as six maps of hardcoded hexes, which meant the rail, the topbar
// pill and the Create button each carried their own copy of the palette and could drift from
// each other and from `brand.C`. It now lives in CSS variables — `--rail`, `--brand-accent`,
// `--brand-gradient` and friends in app/globals.css, redefined under
// `:root[data-brand="konverz"]`, with BrandProvider setting the attribute. One switch,
// one repaint, nothing to keep in sync.
//
// What stays here is what a variable cannot express: copy, and the one place a component
// needs a colour as a VALUE rather than as a style (a dot rendered inside a modal that is
// not on a rail surface).
//
// Status colours are deliberately not brand colours and never move when you switch brands.

/** Right-hand descriptor on a brand row and in the topbar pill. UI copy, not brand data. */
export const BRAND_DESCRIPTOR: Record<BrandId, string> = {
  kognoz: "Consulting",
  konverz: "Talent AI"
};

/** Dot marking the selected brand where a CSS variable is not in scope. */
export const BRAND_DOT: Record<BrandId, string> = {
  kognoz: "bg-[var(--color-cyan)] shadow-sm shadow-[var(--color-cyan)]",
  konverz: "bg-[#6B4FC9] shadow-sm shadow-[#6B4FC9]"
};

/** Status green for dots on the dark rail, legible where AUDIT_OK would be too dark. */
export const CHROME_OK = C.green;
