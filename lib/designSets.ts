// Design sets — ported verbatim from kognoz-social-studio-v3.jsx.
// One visual family per deck (uniformity is a tested invariant, PRD §16).
// `cover` and `contents` are indices into the Slide component's internal
// variant lists — meaningless without that component, which is the biggest
// remaining porting job (the ~600-line <Slide> renderer, jsx lines ~115-730).
// Keeping the indices exactly as-is rather than translating them, so the
// eventual Slide port has a 1:1 reference instead of a re-guessed mapping.

export type DesignSetId = "editorial" | "numeral" | "dark" | "glass" | "bloom" | "magazine" | "mixed";

export interface DesignSetSpec {
  label: string;
  cover: number | null; // index into Slide's cover-variant list; null = rotates (Mixed)
  contents: number[] | null; // indices into Slide's content-variant list; null = rotates (Mixed)
  cards: "classic" | "glass" | null; // stat/dialogue register; null = seed-based (Mixed)
}

export const DESIGN_SETS: Record<DesignSetId, DesignSetSpec> = {
  editorial: { label: "Editorial · light", cover: 0, contents: [0], cards: "classic" },
  numeral: { label: "Numeral · light", cover: 0, contents: [2], cards: "classic" },
  dark: { label: "Boardroom · dark", cover: 1, contents: [1], cards: "glass" },
  glass: { label: "Glass", cover: 3, contents: [7], cards: "glass" },
  bloom: { label: "Bloom · minimal", cover: 2, contents: [5], cards: "classic" },
  magazine: { label: "Magazine · photo", cover: 99, contents: [8], cards: "classic" },
  mixed: { label: "Mixed · max variety", cover: null, contents: null, cards: null }
};

// "Next look" (🎲) cycle — ported from App's LOOK_SETS / LOOK_ACCENTS + cycleLook().
// 6 sets x 5 accents (null = "Auto/pillar" + 4 named colors) = 30 uniform looks.
export const LOOK_SETS: DesignSetId[] = ["editorial", "numeral", "dark", "glass", "bloom", "magazine"];
// LOOK_ACCENTS values are resolved against lib/tokens' C at call sites
// (null | C.blue | C.teal | C.cyan | C.green) — kept as a shape reference here.
export const LOOK_ACCENT_KEYS: (null | "blue" | "teal" | "cyan" | "green")[] = [null, "blue", "teal", "cyan", "green"];
export const TOTAL_LOOKS = LOOK_SETS.length * LOOK_ACCENT_KEYS.length; // 30

// ---------------------------------------------------------------------------
// What a "look" can actually change, per format.
//
// A DesignSetSpec only carries `cover`, `contents` and `cards`. Those drive the
// deck cover/content renderers and the stat/dialogue card register — and nothing
// else. The single-asset renderers for Says vs Does, Montage and Story hardcode
// their backgrounds, and Idea Deck / Founder Video vary only by accent colour.
//
// So "Next look" was cycling a design set that several formats have no way to
// express. The button worked; the formats had nothing to show. Worse, the accent
// only advanced every 6th click, so accent-only formats looked dead 5 clicks in 6.
//
// Every format except Video now renders a light and a dark register, so the button
// steps the card register and lands on a visibly different look on every click.
// ---------------------------------------------------------------------------
export type LookLever = "layout" | "cards" | "accent" | "none";

export function lookLever(spec: { deck?: true; idea?: true; single?: string }): LookLever {
  if (spec.idea) return "cards";         // stash renders a light and a dark register
  if (spec.deck) return "layout";        // Carousel, Square — full cover/content variants
  switch (spec.single) {
    case "article":
      return "layout";
    case "stat":
    case "dialogue":
    case "split":
    case "montage":
    case "story":
    case "script":
      // All six now render a light and a dark register off dset.cards, the way
      // the stat card always did. Story is the odd one: it ships dark, so its
      // second register is the light one.
      return "cards";
    case "video":
      return "cards";                    // kinetic headline, surface-driven like the rest
    default:
      return "none";
  }
}

/**
 * A distinct surface per design set, for the single-asset renderers.
 *
 * The single formats (Montage, Says vs Does, Story, Stat, Dialogue, the Founder
 * Video script, the Idea Deck stash) only ever consulted `dset.cards`, which is
 * "classic" or "glass". So editorial, numeral, bloom and magazine all rendered the
 * SAME light surface and dark + glass rendered the same dark one: six sets, two
 * looks. Cycling every set was pointless when four of them were indistinguishable.
 *
 * Each set now maps to its own surface, so all six sets x five accent tones are
 * genuinely different on every format, the way they already were on decks.
 *
 * Semantic ids only — the concrete colours live with the renderer in <Slide>, so
 * this module stays free of design tokens.
 */
export type SurfaceId = "paper" | "ivory" | "boardroom" | "glass" | "bloom" | "press";

export const SET_SURFACE: Record<Exclude<DesignSetId, "mixed">, SurfaceId> = {
  editorial: "paper",     // off-white page, white cards, hairline rule
  numeral: "ivory",       // white page, mist panels, no borders
  dark: "boardroom",      // dark page, solid glass panels
  glass: "glass",         // dark page, lighter and more translucent
  bloom: "bloom",         // mist page, soft borderless cards
  magazine: "press"       // off-white page, heavy rules, photo-forward
};

export const SURFACE_ORDER: SurfaceId[] = ["paper", "ivory", "boardroom", "glass", "bloom", "press"];

/** Human names, for the "Next look" button when the set itself is "Mixed". */
export const SURFACE_LABELS: Record<SurfaceId, string> = {
  paper: "Paper",
  ivory: "Ivory",
  boardroom: "Boardroom",
  glass: "Glass",
  bloom: "Bloom",
  press: "Press"
};

/** Surfaces that sit on a dark page — the renderer flips its type colours on these. */
export function isDarkSurface(id: SurfaceId): boolean {
  return id === "boardroom" || id === "glass";
}

/**
 * The surface a slide should render. "Mixed" has no fixed surface by design, so it
 * rotates through them on the seed, which is what makes it "max variety".
 */
export function surfaceFor(set: DesignSetId | undefined | null, seed: number): SurfaceId {
  if (!set || set === "mixed") {
    const n = ((seed % SURFACE_ORDER.length) + SURFACE_ORDER.length) % SURFACE_ORDER.length;
    return SURFACE_ORDER[n];
  }
  return SET_SURFACE[set as Exclude<DesignSetId, "mixed">] ?? "paper";
}

/**
 * The next set for a "cards" format. Every set now looks different, so this is a
 * plain walk through LOOK_SETS — no interleaving needed to guarantee a visible change.
 */
export function nextCardSet(step: number): DesignSetId {
  const n = ((step % LOOK_SETS.length) + LOOK_SETS.length) % LOOK_SETS.length;
  return LOOK_SETS[n];
}

