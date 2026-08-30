// How a finished asset actually appears once it is posted.
//
// Nothing in the app modelled this before: FORMATS knows how big a canvas is, and the
// calendar's PLATFORMS knows who posts it, but the two never met. So there was no way
// to find out — short of posting — that a 9:16 Story loses its top and bottom in a
// LinkedIn feed, or that a 12:5 Montage posted as a single image is unreadable.
//
// Everything here is pure: no DOM, no React, no platform SDKs. The table below is the
// whole feature's accuracy budget, so it is data rather than scattered conditionals —
// when a platform changes its crop rules, this is the one place to edit.
//
// Aspect is always WIDTH / HEIGHT. Some reference points:
//   9:16  = 0.5625 (Story)      4:5 = 0.8 (Carousel)     1:1 = 1
//   16:9  = 1.778  (Article)    1.91:1 = 1.91            12:5 = 2.4 (Montage strip)

export type PlacementId =
  | "linkedin-feed"
  | "linkedin-document"
  | "instagram-feed"
  | "instagram-grid"
  | "instagram-story"
  | "x-timeline";

export type PlatformId = "LinkedIn" | "Instagram" | "X (Twitter)";

export interface Placement {
  id: PlacementId;
  platform: PlatformId;
  /** Short name, shown on the tab. */
  label: string;
  /** One line saying what this placement is, shown under the mock. */
  blurb: string;
  /** Narrowest (tallest) aspect shown without cropping. */
  minAspect: number;
  /** Widest aspect shown without cropping. */
  maxAspect: number;
  /** What happens outside that band. */
  outOfRange: "crop" | "fit";
  /** Fraction of the height covered by platform UI. Story only. */
  safeTop?: number;
  safeBottom?: number;
  /** Width the mock card renders at, in CSS px. */
  cardW: number;
  /** Characters before the "…see more" cut. 0 means the caption is never truncated. */
  captionCut: number;
  /** Hard character limit the platform enforces, if any. */
  captionLimit?: number;
  /** This placement shows a multi-page asset as a swipeable carousel. */
  carousel?: boolean;
}

/**
 * The crop table.
 *
 * These are the accepted display bands as they stand, not guarantees — platforms
 * change them, and LinkedIn in particular has widened its portrait allowance more than
 * once. The numbers are surfaced in the UI next to each mock so they can be sanity
 * checked against a real post rather than trusted blindly.
 */
export const PLACEMENTS: Placement[] = [
  {
    id: "linkedin-feed",
    platform: "LinkedIn",
    label: "Feed",
    blurb: "A single image post. Portrait is shown in full down to 4:5; anything taller is centre-cropped.",
    minAspect: 0.8,
    maxAspect: 1.91,
    outOfRange: "crop",
    cardW: 420,
    captionCut: 210
  },
  {
    id: "linkedin-document",
    platform: "LinkedIn",
    label: "Document",
    blurb: "The PDF page-flipper. Every page is shown whole at its own shape — no cropping at all.",
    minAspect: 0.5,
    maxAspect: 2.5,
    outOfRange: "fit",
    cardW: 420,
    captionCut: 210,
    carousel: true
  },
  {
    id: "instagram-feed",
    platform: "Instagram",
    label: "Feed",
    blurb: "The main feed. 4:5 is the tallest shape it will show; wider than 1.91:1 gets cut at the sides.",
    minAspect: 0.8,
    maxAspect: 1.91,
    outOfRange: "crop",
    cardW: 400,
    captionCut: 125
  },
  {
    id: "instagram-grid",
    platform: "Instagram",
    label: "Profile grid",
    blurb: "The square thumbnail on your profile. A 4:5 post loses a fifth of its height here even though the post itself is fine.",
    minAspect: 1,
    maxAspect: 1,
    outOfRange: "crop",
    cardW: 260,
    captionCut: 0
  },
  {
    id: "instagram-story",
    platform: "Instagram",
    label: "Story",
    blurb: "Full screen at 9:16. Anything else is letterboxed, and the platform's own UI sits over the top and bottom.",
    minAspect: 0.5625,
    maxAspect: 0.5625,
    outOfRange: "fit",
    // ~250px of a 1920px frame at each end: the profile row and close button at the
    // top, the reply bar and any link sticker at the bottom.
    safeTop: 250 / 1920,
    safeBottom: 250 / 1920,
    cardW: 300,
    captionCut: 0
  },
  {
    id: "x-timeline",
    platform: "X (Twitter)",
    label: "Timeline",
    blurb: "A single image in the timeline. Wider than 16:9 or taller than 4:5 is centre-cropped until someone taps it.",
    minAspect: 0.8,
    maxAspect: 16 / 9,
    outOfRange: "crop",
    cardW: 400,
    captionCut: 0,
    captionLimit: 280
  }
];

export function placementById(id: PlacementId): Placement {
  const hit = PLACEMENTS.find((p) => p.id === id);
  if (!hit) throw new Error(`unknown placement: ${id}`);
  return hit;
}

export type FitMode = "full" | "cropped" | "letterboxed";
export type FitSeverity = "ok" | "minor" | "severe";

export interface Fit {
  mode: FitMode;
  /** The aspect the viewer actually sees. */
  renderedAspect: number;
  /**
   * Fraction of the asset removed at each edge, 0–0.5. Deliberately unrounded: these
   * drive the preview's layout, and rounding a geometry input is error for no gain.
   */
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
  /** Percentage of the asset's area the viewer never sees, 0–100. */
  lostPct: number;
  axis: "none" | "vertical" | "horizontal";
  severity: FitSeverity;
}

const round = (n: number, dp = 4) => Math.round(n * 10 ** dp) / 10 ** dp;
// `-0 * x` is `-0`, which is real enough to fail an equality check on an offset that
// is conceptually zero. Geometry callers should never have to think about it.
const noNegZero = (n: number) => (n === 0 ? 0 : n);

/**
 * What this placement does to an asset of these proportions.
 *
 * Cropping is always centred, which is what every platform in the table does, so the
 * loss is split evenly between the two opposing edges.
 */
export function placementFit(assetW: number, assetH: number, placement: Placement): Fit {
  if (!(assetW > 0) || !(assetH > 0)) throw new Error("placementFit needs positive dimensions");
  const aspect = assetW / assetH;
  const none: Omit<Fit, "mode" | "renderedAspect" | "severity"> = {
    cropTop: 0,
    cropBottom: 0,
    cropLeft: 0,
    cropRight: 0,
    lostPct: 0,
    axis: "none"
  };

  if (aspect >= placement.minAspect && aspect <= placement.maxAspect) {
    return { mode: "full", renderedAspect: round(aspect), ...none, severity: "ok" };
  }

  // Letterboxing keeps every pixel; the asset is just pillarboxed or bordered.
  if (placement.outOfRange === "fit") {
    return { mode: "letterboxed", renderedAspect: round(aspect), ...none, severity: "minor" };
  }

  if (aspect > placement.maxAspect) {
    // Too wide: the sides go.
    const shownW = assetH * placement.maxAspect;
    const lost = (assetW - shownW) / assetW;
    return {
      mode: "cropped",
      renderedAspect: round(placement.maxAspect),
      cropTop: 0,
      cropBottom: 0,
      cropLeft: lost / 2,
      cropRight: lost / 2,
      lostPct: round(lost * 100, 1),
      axis: "horizontal",
      severity: severityOf(lost, "horizontal")
    };
  }

  // Too tall: the top and bottom go. This is the Story-in-a-feed case.
  const shownH = assetW / placement.minAspect;
  const lost = (assetH - shownH) / assetH;
  return {
    mode: "cropped",
    renderedAspect: round(placement.minAspect),
    cropTop: lost / 2,
    cropBottom: lost / 2,
    cropLeft: 0,
    cropRight: 0,
    lostPct: round(lost * 100, 1),
    axis: "vertical",
    severity: severityOf(lost, "vertical")
  };
}

/**
 * The two axes are not equally damaging, so one threshold gives the wrong answer.
 *
 * These layouts anchor their furniture to the left and right edges — the footer sits
 * at `left: 96, right: 96`, the eyebrow at the left margin, the logo at the right — so
 * a horizontal crop removes the branding almost immediately. A vertical crop eats top
 * and bottom margin first, which is why a 4:5 post losing 20% in the Instagram grid is
 * a normal, expected thumbnail and not a problem.
 *
 * Concretely: the 12:5 Montage strip posted as one image loses 20.4% off the sides,
 * which takes the eyebrow and the logo with it. A single threshold would have called
 * that fine.
 */
function severityOf(lostFraction: number, axis: "vertical" | "horizontal"): FitSeverity {
  if (lostFraction >= 0.25) return "severe";
  if (axis === "horizontal" && lostFraction >= 0.15) return "severe";
  return "minor";
}

/**
 * The asset a placement should actually preview.
 *
 * A framed format is posted as its frames, never as the strip — a 3240×1350 Montage is
 * three 1080×1350 slides. Previewing the strip would answer a question nobody asks.
 */
export function previewAssetSize(baseW: number, baseH: number, frames?: number): { w: number; h: number } {
  return frames && frames > 1 ? { w: baseW / frames, h: baseH } : { w: baseW, h: baseH };
}

export interface CaptionFit {
  /** The part visible before any "see more". */
  shown: string;
  /** What is hidden behind it. Empty when nothing is truncated. */
  hidden: string;
  truncated: boolean;
  /** Over the platform's hard limit — the post would be rejected, not shortened. */
  overLimit: boolean;
  charCount: number;
}

/** Where the caption gets cut, so you can see whether the hook survives. */
export function captionFit(text: string, placement: Placement): CaptionFit {
  const clean = text ?? "";
  const cut = placement.captionCut;
  const truncated = cut > 0 && clean.length > cut;
  return {
    shown: truncated ? clean.slice(0, cut) : clean,
    hidden: truncated ? clean.slice(cut) : "",
    truncated,
    overLimit: placement.captionLimit != null && clean.length > placement.captionLimit,
    charCount: clean.length
  };
}

/**
 * A plain-language warning, or null when there is nothing to say.
 *
 * The wording matters more than it looks: "this is cropped" is useless without saying
 * which edge and how much, because the fix is different for each.
 */
export function fitWarning(fit: Fit, placement: Placement): string | null {
  if (fit.mode === "full") return null;
  if (fit.mode === "letterboxed") {
    return `Not this placement's shape — it will sit inside bars rather than filling the frame.`;
  }
  const where = fit.axis === "vertical" ? "the top and bottom" : "both sides";
  return `${fit.lostPct}% cropped from ${where} to reach ${describeAspect(fit.renderedAspect)}. Keep anything that matters away from ${where}.`;
}

/** 0.8 → "4:5". Falls back to a decimal ratio for anything not on the list. */
export function describeAspect(aspect: number): string {
  const known: Array<[number, string]> = [
    [9 / 16, "9:16"],
    [0.8, "4:5"],
    [1, "1:1"],
    [4 / 3, "4:3"],
    [16 / 9, "16:9"],
    [1.91, "1.91:1"],
    [2.4, "12:5"]
  ];
  const hit = known.find(([v]) => Math.abs(v - aspect) < 0.005);
  return hit ? hit[1] : `${round(aspect, 2)}:1`;
}

// ---------------------------------------------------------------------------
// Placing the artwork inside a mock card.
//
// The preview shrinks a native-size <Slide> with a CSS transform inside a clipping
// box, so every card needs a scale and a translate. Two different shifts land in that
// one translate and they are easy to conflate:
//
//   the FRAME shift   only for a framed format, where one wide node holds every frame
//                     and the box picks out a slice of it
//   the CROP shift    for any placement that trims the asset to its own shape
//
// A deck page is its own node — the caller has already chosen which — so it must never
// get the frame shift. Applying it anyway pushed every page after the first entirely
// outside its box, which is exactly what happened: Carousel showed slide 1 and then
// five blanks. The guard lives here now, in one place, under test.
// ---------------------------------------------------------------------------

/** How far left the node slides to bring `frameIndex` into view. Zero for decks. */
export function frameShiftPx(assetW: number, frames: number | undefined, frameIndex: number, scale: number): number {
  if (!frames || frames <= 1) return 0;
  return noNegZero(-frameIndex * assetW * scale);
}

export interface ArtworkTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  /** Height of the clipping box at this width. */
  boxH: number;
}

/**
 * Where to put the node so the box shows what the platform would show.
 *
 * `reveal` is the "show what gets cropped" view: the whole asset at box width with the
 * crop ignored, so the discarded bands can be dimmed over it.
 */
export function artworkTransform(opts: {
  assetW: number;
  assetH: number;
  frames?: number;
  frameIndex: number;
  boxWidth: number;
  fit: Fit;
  reveal?: boolean;
}): ArtworkTransform {
  const { assetW, assetH, frames, frameIndex, boxWidth, fit, reveal } = opts;
  if (!(assetW > 0) || !(assetH > 0) || !(boxWidth > 0)) {
    throw new Error("artworkTransform needs positive dimensions");
  }

  if (reveal) {
    const scale = boxWidth / assetW;
    return {
      scale,
      offsetX: noNegZero(frameShiftPx(assetW, frames, frameIndex, scale)),
      offsetY: 0,
      boxH: assetH * scale
    };
  }

  const shownW = assetW * (1 - fit.cropLeft - fit.cropRight);
  const shownH = assetH * (1 - fit.cropTop - fit.cropBottom);
  const scale = boxWidth / shownW;
  return {
    scale,
    offsetX: noNegZero(frameShiftPx(assetW, frames, frameIndex, scale) - fit.cropLeft * assetW * scale),
    offsetY: noNegZero(-fit.cropTop * assetH * scale),
    boxH: shownH * scale
  };
}
