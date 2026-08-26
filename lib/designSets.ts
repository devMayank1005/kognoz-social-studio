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
    default:
      return "none";                     // video: poster frame only, no look to cycle
  }
}

/** Sets whose card register differs from the current one, for "cards" formats. */
export function nextSetWithDifferentCards(current: DesignSetId): DesignSetId {
  const cur = DESIGN_SETS[current] || DESIGN_SETS.editorial;
  const order = LOOK_SETS;
  const from = Math.max(0, order.indexOf(current));
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(from + step) % order.length];
    if (DESIGN_SETS[candidate].cards !== cur.cards) return candidate;
  }
  return order[(from + 1) % order.length];
}

/**
 * Which register a slide will actually render in.
 *
 * This was duplicated inline in <Slide> while the "Next look" button described the
 * design SET instead. On the "mixed" set the two disagree: `cards` is null, so the
 * register flips on seed parity and the artwork changes, but the set name never
 * moves — the button reads "Mixed" forever and looks stuck while the slide toggles.
 *
 * One definition, used by both, so the label can never drift from the render.
 */
export function isDarkRegister(set: DesignSetId | undefined | null, seed: number): boolean {
  const dset = DESIGN_SETS[set || "editorial"] || DESIGN_SETS.editorial;
  return dset.cards === "glass" || (dset.cards === null && seed % 2 === 1);
}
