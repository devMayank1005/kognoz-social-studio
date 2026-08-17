import { describe, it, expect } from "vitest";
import { FORMATS, STUDIO_FORMATS, DECK_SLIDE_LIMITS } from "./formats";
import { DESIGN_SETS, LOOK_SETS, LOOK_ACCENT_KEYS, TOTAL_LOOKS } from "./designSets";

describe("formats", () => {
  it("has all 11 studio formats from the reference implementation", () => {
    expect(Object.keys(FORMATS)).toHaveLength(11);
    expect(STUDIO_FORMATS).toHaveLength(11);
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
