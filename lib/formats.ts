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
  article: 1, // cover + a standfirst body
  stat: 1, // slides[0]
  story: 1, // slides[0]
  video: 4, // four kinetic beats revealed in sequence
  split: 2, // slides[0..1]
  montage: 3, // slides[0..2]
  dialogue: 8, // maps all
  script: 8 // maps all
};

/**
 * What each format will actually produce, shown next to the Generate button so the
 * choice is informed BEFORE credit is spent. Generation is format-specific — the
 * prompt, the slide count and the shape of a "slide" all differ — so picking the
 * format afterwards means paying twice.
 */
export const FORMAT_BRIEF: Record<FormatId, string> = {
  Carousel: "5–6 slides, cover and closing card",
  Square: "3–4 slides, cover and closing card",
  "Idea Deck": "6–7 idea cards with kickers",
  "Article Cover": "wide 16:9 headline and standfirst",
  "Stat Card": "one figure and what it means",
  "Says vs Does": "two halves: what is said, what is done",
  Dialogue: "4–5 message exchange",
  Montage: "one wide strip, 3 frames, complete argument",
  Story: "vertical 9:16, hook to takeaway",
  Video: "4 kinetic beats revealed in sequence",
  "Founder Video": "4 timecoded beats plus a caption"
};

/**
 * Body budget per format, honoured by coerceContent.
 *
 * The default clamp is 230 characters. Formats whose prompt asks for more must say
 * so here or the extra copy is cut silently, with no error and nothing in the UI —
 * which is precisely how a longer prompt can look like it changed nothing.
 */
export const FORMAT_BODY_BUDGET: Partial<Record<FormatId, number>> = {
  Story: 460, // hook + development + takeaway, three paragraphs in one tall frame
  "Article Cover": 340, // the standfirst carries the whole 16:9 width
  "Founder Video": 260 // the Insight beat asks ~240 and was being clipped at 230
};

export function bodyBudgetFor(format: FormatId): number {
  return FORMAT_BODY_BUDGET[format] ?? 230;
}

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
