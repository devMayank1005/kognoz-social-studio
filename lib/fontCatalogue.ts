/**
 * The font catalogue: 108 families, with the weights and italics they are ACTUALLY served at.
 *
 * GENERATED, THEN VERIFIED. Every row here came out of Google's public font metadata
 * (`https://fonts.google.com/metadata/fonts`), not from memory, and every `axis` string was
 * then fetched from the css2 API — all 108 returned HTTP 200. That matters more than it
 * sounds: lib/fontRegistry.ts exists because a family was once requested at weights it did
 * not serve, so the browser synthesised a bold on screen while the export embedded a real
 * file at a different weight, and the preview and the download silently disagreed. A
 * catalogue written from memory would reintroduce exactly that bug, one family at a time.
 *
 * It is a source file rather than a runtime fetch on purpose: no API key, no network on the
 * hot path, and the whole thing is unit-testable. Refreshing it is running the generator
 * again — the families are a curated list, the weights are never hand-edited.
 *
 * Every family here is tagged `extra` by lib/fontRegistry.ts, which is what keeps the two
 * byte-pinned brand export URLs untouched: a catalogue family only ever enters an export
 * when a deck actually uses it.
 */

export type FontCategory = "sans" | "serif" | "display" | "handwriting" | "mono";

export interface CatalogueEntry {
  family: string;
  category: FontCategory;
  /**
   * The css2 axis spec, verbatim and in the order the API expects: uprights first as
   * `0,<weight>`, then italics as `1,<weight>`. Kept as a string rather than rebuilt from
   * the arrays below because that string is what the URL is pinned on.
   */
  axis: string;
  /** Real upright weights. The picker offers these and nothing else. */
  weights: number[];
  /** Real italic weights. Empty when the family has no italic at all. */
  italics: number[];
}

export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: "sans", label: "Sans serif" },
  { id: "serif", label: "Serif" },
  { id: "display", label: "Display" },
  { id: "handwriting", label: "Handwriting" },
  { id: "mono", label: "Monospace" }
];

export const FONT_CATALOGUE: CatalogueEntry[] = [
  { family: "Inter", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Roboto", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Open Sans", category: "sans", axis: "ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800", weights: [300, 400, 500, 600, 700, 800], italics: [300, 400, 500, 600, 700, 800] },
  { family: "Montserrat", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Poppins", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Lato", category: "sans", axis: "ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900", weights: [100, 300, 400, 700, 900], italics: [100, 300, 400, 700, 900] },
  { family: "Raleway", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Nunito", category: "sans", axis: "ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;0,1000;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900;1,1000", weights: [200, 300, 400, 500, 600, 700, 800, 900, 1000], italics: [200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { family: "Nunito Sans", category: "sans", axis: "ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;0,1000;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900;1,1000", weights: [200, 300, 400, 500, 600, 700, 800, 900, 1000], italics: [200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { family: "Work Sans", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Outfit", category: "sans", axis: "wght@100;200;300;400;500;600;700;800;900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [] },
  { family: "DM Sans", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;0,1000;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900;1,1000", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { family: "Figtree", category: "sans", axis: "ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [300, 400, 500, 600, 700, 800, 900], italics: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Mulish", category: "sans", axis: "ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;0,1000;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900;1,1000", weights: [200, 300, 400, 500, 600, 700, 800, 900, 1000], italics: [200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { family: "Source Sans 3", category: "sans", axis: "ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [200, 300, 400, 500, 600, 700, 800, 900], italics: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Archivo", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Barlow", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Jost", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Karla", category: "sans", axis: "ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300;1,400;1,500;1,600;1,700;1,800", weights: [200, 300, 400, 500, 600, 700, 800], italics: [200, 300, 400, 500, 600, 700, 800] },
  { family: "Fira Sans", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Space Grotesk", category: "sans", axis: "wght@300;400;500;600;700", weights: [300, 400, 500, 600, 700], italics: [] },
  { family: "Manrope", category: "sans", axis: "wght@200;300;400;500;600;700;800", weights: [200, 300, 400, 500, 600, 700, 800], italics: [] },
  { family: "Rubik", category: "sans", axis: "ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [300, 400, 500, 600, 700, 800, 900], italics: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Ubuntu", category: "sans", axis: "ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700", weights: [300, 400, 500, 700], italics: [300, 400, 500, 700] },
  { family: "Kanit", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Titillium Web", category: "sans", axis: "ital,wght@0,200;0,300;0,400;0,600;0,700;0,900;1,200;1,300;1,400;1,600;1,700", weights: [200, 300, 400, 600, 700, 900], italics: [200, 300, 400, 600, 700] },
  { family: "IBM Plex Sans", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700", weights: [100, 200, 300, 400, 500, 600, 700], italics: [100, 200, 300, 400, 500, 600, 700] },
  { family: "Plus Jakarta Sans", category: "sans", axis: "ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300;1,400;1,500;1,600;1,700;1,800", weights: [200, 300, 400, 500, 600, 700, 800], italics: [200, 300, 400, 500, 600, 700, 800] },
  { family: "Quicksand", category: "sans", axis: "wght@300;400;500;600;700", weights: [300, 400, 500, 600, 700], italics: [] },
  { family: "PT Sans", category: "sans", axis: "ital,wght@0,400;0,700;1,400;1,700", weights: [400, 700], italics: [400, 700] },
  { family: "Cabin", category: "sans", axis: "ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700", weights: [400, 500, 600, 700], italics: [400, 500, 600, 700] },
  { family: "Asap", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Heebo", category: "sans", axis: "wght@100;200;300;400;500;600;700;800;900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [] },
  { family: "Assistant", category: "sans", axis: "wght@200;300;400;500;600;700;800", weights: [200, 300, 400, 500, 600, 700, 800], italics: [] },
  { family: "Exo 2", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Oswald", category: "sans", axis: "wght@200;300;400;500;600;700", weights: [200, 300, 400, 500, 600, 700], italics: [] },
  { family: "Roboto Condensed", category: "sans", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Bebas Neue", category: "sans", axis: "wght@400", weights: [400], italics: [] },
  { family: "Archivo Black", category: "sans", axis: "wght@400", weights: [400], italics: [] },
  { family: "Anton", category: "sans", axis: "wght@400", weights: [400], italics: [] },
  { family: "Playfair Display", category: "serif", axis: "ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900", weights: [400, 500, 600, 700, 800, 900], italics: [400, 500, 600, 700, 800, 900] },
  { family: "Merriweather", category: "serif", axis: "ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [300, 400, 500, 600, 700, 800, 900], italics: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Lora", category: "serif", axis: "ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700", weights: [400, 500, 600, 700], italics: [400, 500, 600, 700] },
  { family: "Roboto Slab", category: "serif", axis: "wght@100;200;300;400;500;600;700;800;900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [] },
  { family: "Libre Baskerville", category: "serif", axis: "ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700", weights: [400, 500, 600, 700], italics: [400, 500, 600, 700] },
  { family: "PT Serif", category: "serif", axis: "ital,wght@0,400;0,700;1,400;1,700", weights: [400, 700], italics: [400, 700] },
  { family: "Source Serif 4", category: "serif", axis: "ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [200, 300, 400, 500, 600, 700, 800, 900], italics: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Crimson Text", category: "serif", axis: "ital,wght@0,400;0,600;0,700;1,400;1,600;1,700", weights: [400, 600, 700], italics: [400, 600, 700] },
  { family: "EB Garamond", category: "serif", axis: "ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800", weights: [400, 500, 600, 700, 800], italics: [400, 500, 600, 700, 800] },
  { family: "Cormorant Garamond", category: "serif", axis: "ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700", weights: [300, 400, 500, 600, 700], italics: [300, 400, 500, 600, 700] },
  { family: "Bitter", category: "serif", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Arvo", category: "serif", axis: "ital,wght@0,400;0,700;1,400;1,700", weights: [400, 700], italics: [400, 700] },
  { family: "Zilla Slab", category: "serif", axis: "ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700", weights: [300, 400, 500, 600, 700], italics: [300, 400, 500, 600, 700] },
  { family: "Spectral", category: "serif", axis: "ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300;1,400;1,500;1,600;1,700;1,800", weights: [200, 300, 400, 500, 600, 700, 800], italics: [200, 300, 400, 500, 600, 700, 800] },
  { family: "Cardo", category: "serif", axis: "ital,wght@0,400;0,700;1,400", weights: [400, 700], italics: [400] },
  { family: "Vollkorn", category: "serif", axis: "ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900", weights: [400, 500, 600, 700, 800, 900], italics: [400, 500, 600, 700, 800, 900] },
  { family: "Alegreya", category: "serif", axis: "ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900", weights: [400, 500, 600, 700, 800, 900], italics: [400, 500, 600, 700, 800, 900] },
  { family: "Frank Ruhl Libre", category: "serif", axis: "wght@300;400;500;600;700;800;900", weights: [300, 400, 500, 600, 700, 800, 900], italics: [] },
  { family: "Fraunces", category: "serif", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Bodoni Moda", category: "serif", axis: "ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900", weights: [400, 500, 600, 700, 800, 900], italics: [400, 500, 600, 700, 800, 900] },
  { family: "DM Serif Display", category: "serif", axis: "ital,wght@0,400;1,400", weights: [400], italics: [400] },
  { family: "Instrument Serif", category: "serif", axis: "ital,wght@0,400;1,400", weights: [400], italics: [400] },
  { family: "Young Serif", category: "serif", axis: "wght@400", weights: [400], italics: [] },
  { family: "Newsreader", category: "serif", axis: "ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300;1,400;1,500;1,600;1,700;1,800", weights: [200, 300, 400, 500, 600, 700, 800], italics: [200, 300, 400, 500, 600, 700, 800] },
  { family: "Abril Fatface", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Righteous", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Alfa Slab One", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Bungee", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Lobster", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Staatliches", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Passion One", category: "display", axis: "wght@400;700;900", weights: [400, 700, 900], italics: [] },
  { family: "Fredoka", category: "display", axis: "wght@300;400;500;600;700", weights: [300, 400, 500, 600, 700], italics: [] },
  { family: "Baloo 2", category: "display", axis: "wght@400;500;600;700;800", weights: [400, 500, 600, 700, 800], italics: [] },
  { family: "Monoton", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Ultra", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Titan One", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Bowlby One", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Concert One", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Shrikhand", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Syne", category: "display", axis: "wght@400;500;600;700;800", weights: [400, 500, 600, 700, 800], italics: [] },
  { family: "Chewy", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Rampart One", category: "display", axis: "wght@400", weights: [400], italics: [] },
  { family: "Silkscreen", category: "display", axis: "wght@400;700", weights: [400, 700], italics: [] },
  { family: "Codystar", category: "display", axis: "wght@300;400", weights: [300, 400], italics: [] },
  { family: "Caveat", category: "handwriting", axis: "wght@400;500;600;700", weights: [400, 500, 600, 700], italics: [] },
  { family: "Dancing Script", category: "handwriting", axis: "wght@400;500;600;700", weights: [400, 500, 600, 700], italics: [] },
  { family: "Pacifico", category: "handwriting", axis: "wght@400", weights: [400], italics: [] },
  { family: "Satisfy", category: "handwriting", axis: "wght@400", weights: [400], italics: [] },
  { family: "Great Vibes", category: "handwriting", axis: "wght@400", weights: [400], italics: [] },
  { family: "Sacramento", category: "handwriting", axis: "wght@400", weights: [400], italics: [] },
  { family: "Shadows Into Light", category: "handwriting", axis: "wght@400", weights: [400], italics: [] },
  { family: "Indie Flower", category: "handwriting", axis: "wght@400", weights: [400], italics: [] },
  { family: "Permanent Marker", category: "handwriting", axis: "wght@400", weights: [400], italics: [] },
  { family: "Kalam", category: "handwriting", axis: "wght@300;400;700", weights: [300, 400, 700], italics: [] },
  { family: "Architects Daughter", category: "handwriting", axis: "wght@400", weights: [400], italics: [] },
  { family: "Patrick Hand", category: "handwriting", axis: "wght@400", weights: [400], italics: [] },
  { family: "Amatic SC", category: "handwriting", axis: "wght@400;700", weights: [400, 700], italics: [] },
  { family: "Courgette", category: "handwriting", axis: "wght@400", weights: [400], italics: [] },
  { family: "Roboto Mono", category: "mono", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700", weights: [100, 200, 300, 400, 500, 600, 700], italics: [100, 200, 300, 400, 500, 600, 700] },
  { family: "JetBrains Mono", category: "mono", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800", weights: [100, 200, 300, 400, 500, 600, 700, 800], italics: [100, 200, 300, 400, 500, 600, 700, 800] },
  { family: "IBM Plex Mono", category: "mono", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700", weights: [100, 200, 300, 400, 500, 600, 700], italics: [100, 200, 300, 400, 500, 600, 700] },
  { family: "Source Code Pro", category: "mono", axis: "ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [200, 300, 400, 500, 600, 700, 800, 900], italics: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Fira Code", category: "mono", axis: "wght@300;400;500;600;700", weights: [300, 400, 500, 600, 700], italics: [] },
  { family: "Space Mono", category: "mono", axis: "ital,wght@0,400;0,700;1,400;1,700", weights: [400, 700], italics: [400, 700] },
  { family: "Inconsolata", category: "mono", axis: "wght@200;300;400;500;600;700;800;900", weights: [200, 300, 400, 500, 600, 700, 800, 900], italics: [] },
  { family: "Courier Prime", category: "mono", axis: "ital,wght@0,400;0,700;1,400;1,700", weights: [400, 700], italics: [400, 700] },
  { family: "DM Mono", category: "mono", axis: "ital,wght@0,300;0,400;0,500;1,300;1,400;1,500", weights: [300, 400, 500], italics: [300, 400, 500] },
  { family: "Azeret Mono", category: "mono", axis: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italics: [100, 200, 300, 400, 500, 600, 700, 800, 900] }
];

const BY_FAMILY = new Map(FONT_CATALOGUE.map((e) => [e.family.toLowerCase(), e]));

export function catalogueEntry(family: string): CatalogueEntry | undefined {
  return BY_FAMILY.get(family.trim().toLowerCase());
}

/** Does this family serve this exact face, or would the browser have to fake it? */
export function hasFace(family: string, weight: number, italic: boolean): boolean {
  const entry = catalogueEntry(family);
  if (!entry) return false;
  return (italic ? entry.italics : entry.weights).includes(weight);
}

/**
 * The css2 axis for exactly the faces given — what an EXPORT should ask for.
 *
 * A family's full axis can be eighteen faces; a deck that uses one of them should not embed
 * the other seventeen as base64 in every slide. Ordering matters: uprights ascending, then
 * italics ascending, or the API returns 400 and the export silently loses the font.
 */
export function axisForFaces(weights: readonly number[], italics: readonly number[]): string {
  const up = [...new Set(weights)].sort((a, b) => a - b);
  const it = [...new Set(italics)].sort((a, b) => a - b);
  if (!up.length && !it.length) return "";
  if (!it.length) return `wght@${up.join(";")}`;
  const upright = up.length ? up : [400];
  return `ital,wght@${upright.map((w) => `0,${w}`).join(";")};${it.map((w) => `1,${w}`).join(";")}`;
}

/** Families matching a query and/or a category. An empty query returns the category's whole list. */
export function searchFonts(query: string, category?: FontCategory | "all"): CatalogueEntry[] {
  const q = query.trim().toLowerCase();
  return FONT_CATALOGUE.filter((e) => {
    if (category && category !== "all" && e.category !== category) return false;
    return !q || e.family.toLowerCase().includes(q);
  });
}

/** A CSS stack for a family, single-quoted so it can sit inside a double-quoted style attribute. */
export function stackFor(entry: CatalogueEntry): string {
  const fallback =
    entry.category === "serif" ? "serif" : entry.category === "mono" ? "monospace" : entry.category === "handwriting" ? "cursive" : "sans-serif";
  return `'${entry.family}', ${fallback}`;
}
