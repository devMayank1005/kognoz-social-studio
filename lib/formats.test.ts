import { describe, it, expect } from "vitest";
import { FORMATS, STUDIO_FORMATS, DECK_SLIDE_LIMITS } from "./formats";
import { DESIGN_SETS, LOOK_SETS, LOOK_ACCENT_KEYS, TOTAL_LOOKS } from "./designSets";

describe("formats", () => {
  // 11 in the v3 reference, 15 since the v4 reference added Feature Card,
  // Numbers Wall, Customer Quote and Journey Map. The order is asserted, not just
  // the count: STUDIO_FORMATS is what the picker renders, and the v4 file groups
  // it deliberately — decks, then the editorial single, then the evidence
  // singles, then the conversational and motion ones.
  it("has all 15 studio formats from the v4 reference, in its order", () => {
    expect(Object.keys(FORMATS)).toHaveLength(15);
    expect(STUDIO_FORMATS).toEqual([
      "Carousel",
      "Square",
      "Idea Deck",
      "Article Cover",
      "Stat Card",
      "Says vs Does",
      "Feature Card",
      "Numbers Wall",
      "Customer Quote",
      "Journey Map",
      "Dialogue",
      "Montage",
      "Story",
      "Video",
      "Founder Video"
    ]);
  });

  it("the four v4 formats are all 1080x1350 singles", () => {
    for (const f of ["Feature Card", "Numbers Wall", "Customer Quote", "Journey Map"] as const) {
      expect(FORMATS[f]).toMatchObject({ w: 1080, h: 1350 });
      expect(FORMATS[f].single).toBeTruthy();
    }
  });

  it("deck slide count bounds match PRD (2-8)", () => {
    expect(DECK_SLIDE_LIMITS).toEqual({ min: 2, max: 8 });
  });

  it("Stat Card is square (1080x1080) per the reference jsx, not 1080x1350", () => {
    expect(FORMATS["Stat Card"]).toMatchObject({ w: 1080, h: 1080 });
  });

  it("Montage is a 3-frame 3240-wide panorama", () => {
    expect(FORMATS.Montage).toMatchObject({ w: 3240, h: 1350, frames: 3 });
  });
});

describe("design sets", () => {
  it("has all 7 sets from the reference jsx", () => {
    expect(Object.keys(DESIGN_SETS)).toHaveLength(7);
  });

  it("next-look cycle math matches the app's LOOK_SETS x LOOK_ACCENTS = 30", () => {
    expect(LOOK_SETS).toHaveLength(6);
    expect(LOOK_ACCENT_KEYS).toHaveLength(5);
    expect(TOTAL_LOOKS).toBe(30);
  });

  it("mixed set has null cover/contents/cards (rotates, seed-based)", () => {
    expect(DESIGN_SETS.mixed).toEqual({ label: "Mixed · max variety", cover: null, contents: null, cards: null });
  });
});

// ---------------------------------------------------------------------------
// Guard: every format the picker offers must have a renderer.
//
// The `video` renderer was deleted by an unrelated edit and shipped to
// production. `FORMATS.Video` stayed selectable, so choosing it fell through
// every `kind ===` guard in <Slide> to the default content renderer and drew an
// empty card. Nothing tied the format list to the renderer's dispatch, so no
// test could fail. This is that tie.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("every format has a renderer", () => {
  const slideSrc = readFileSync(join(process.cwd(), "components/Slide.tsx"), "utf8");
  const branches = new Set(Array.from(slideSrc.matchAll(/kind === "(\w+)"/g), (m) => m[1]));

  it("has a `kind ===` branch in Slide.tsx for every single-asset format", () => {
    const missing = STUDIO_FORMATS
      .map((f) => FORMATS[f].single)
      .filter((k): k is NonNullable<typeof k> => Boolean(k))
      .filter((k) => !branches.has(k));
    expect(missing).toEqual([]);
  });

  it("renders video specifically — the one that regressed", () => {
    expect(branches.has("video")).toBe(true);
  });

  it("covers the deck kinds too", () => {
    for (const k of ["cover", "content", "end"]) expect(branches.has(k)).toBe(true);
  });
});
