// Content formats — ported verbatim from kognoz-social-studio-v3.jsx `FORMATS`.
// deck=true builds cover+slides+end; single formats render one bespoke asset.
// Note: Stat Card is 1080x1080 here (square) — the PRD prose table says
// 1080x1350, but this reference object is the proven, shipped values per
// "port, don't reinvent." Flagging the discrepancy rather than silently
// picking one; if it matters, confirm with the team before changing it.

export type FormatId =
  | "Carousel"
  | "Square"
  | "Idea Deck"
  | "Article Cover"
  | "Stat Card"
  | "Says vs Does"
  | "Dialogue"
  | "Montage"
  | "Story"
  | "Video"
  | "Founder Video";

export type SingleKind = "article" | "stat" | "split" | "dialogue" | "montage" | "story" | "video" | "script";

export interface FormatSpec {
  w: number;
  h: number;
  deck?: true;
  idea?: true;
  frames?: number;
  single?: SingleKind;
  hint: string;
}

export const FORMATS: Record<FormatId, FormatSpec> = {
  Carousel: { w: 1080, h: 1350, deck: true, hint: "Carousel · 4:5" },
  Square: { w: 1080, h: 1080, deck: true, hint: "Square · 1:1" },
  "Idea Deck": { w: 1080, h: 1350, deck: true, idea: true, hint: "Idea Deck · Stash" },
  "Article Cover": { w: 1920, h: 1080, single: "article", hint: "Article · 16:9" },
  "Stat Card": { w: 1080, h: 1080, single: "stat", hint: "Stat · 1:1" },
  "Says vs Does": { w: 1080, h: 1350, single: "split", hint: "Split · 4:5" },
  Dialogue: { w: 1080, h: 1350, single: "dialogue", hint: "Chat · 4:5" },
  Montage: { w: 3240, h: 1350, single: "montage", frames: 3, hint: "Montage · 3 frames" },
  Story: { w: 1080, h: 1920, single: "story", hint: "Story · 9:16" },
  Video: { w: 1080, h: 1350, single: "video", hint: "Video · Kinetic" },
  "Founder Video": { w: 1080, h: 1350, single: "script", hint: "Founder Video · Script" }
};

// Text post / Poll are calendar-only (§4) — written by the caption engine,
// no visual asset, so they're deliberately not in FORMATS above.
export const CALENDAR_ONLY_FORMATS = ["Text post", "Poll"] as const;

// How many slides each single-asset renderer actually DRAWS. Anything past this is
// silently dropped by <Slide>, so the editor must not offer to add it. Counts are
// read straight off the renderers in components/Slide.tsx.
export const SLIDE_SLOTS: Record<SingleKind, number> = {
  article: 0, // renders `cover` only
  stat: 1, // slides[0]
  story: 1, // slides[0]
  video: 1, // slides[0]
  split: 2, // slides[0..1]
  montage: 3, // slides[0..2]
  dialogue: 8, // maps all
  script: 8 // maps all
};

export const STUDIO_FORMATS: FormatId[] = [
  "Carousel",
  "Square",
  "Idea Deck",
  "Article Cover",
  "Stat Card",
  "Says vs Does",
  "Dialogue",
  "Montage",
  "Story",
  "Video",
  "Founder Video"
];

export const DECK_SLIDE_LIMITS = { min: 2, max: 8 } as const;
