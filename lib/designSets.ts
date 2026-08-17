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
