import { describe, it, expect } from "vitest";
import {
  PLACEMENTS,
  placementById,
  placementFit,
  previewAssetSize,
  captionFit,
  fitWarning,
  describeAspect
} from "./socialPreview";
import { FORMATS } from "./formats";

// The point of this module is to answer one question before you post rather than
// after: what does this platform cut off? These cases are the ones that actually
// bite — a Story in a feed, a Montage strip posted as a single image, and a 4:5
// carousel that is fine as a post and wrong in the profile grid.

const fit = (w: number, h: number, id: Parameters<typeof placementById>[0]) => placementFit(w, h, placementById(id));

describe("the crop table itself", () => {
  it("covers the three platforms that were asked for", () => {
    expect(new Set(PLACEMENTS.map((p) => p.platform))).toEqual(new Set(["LinkedIn", "Instagram", "X (Twitter)"]));
  });

  it("has no placement whose band is inverted", () => {
    for (const p of PLACEMENTS) {
      expect(p.minAspect, `${p.id} min must not exceed max`).toBeLessThanOrEqual(p.maxAspect);
      expect(p.cardW).toBeGreaterThan(0);
    }
  });

  it("only the Story declares platform UI over the asset", () => {
    const withSafe = PLACEMENTS.filter((p) => p.safeTop || p.safeBottom).map((p) => p.id);
    expect(withSafe).toEqual(["instagram-story"]);
  });

  it("rejects an unknown placement rather than returning a default", () => {
    // A silent fallback here would preview the wrong crop, which is worse than an error.
    expect(() => placementById("tiktok" as never)).toThrow(/unknown placement/);
  });
});

describe("Story (9:16) — the format that loses most", () => {
  const { w, h } = FORMATS.Story; // 1080x1920

  it("fills its own placement", () => {
    expect(fit(w, h, "instagram-story").mode).toBe("full");
  });

  it("is cropped top and bottom in a LinkedIn feed, severely", () => {
    const f = fit(w, h, "linkedin-feed");
    expect(f.mode).toBe("cropped");
    expect(f.axis).toBe("vertical");
    expect(f.severity).toBe("severe");
    // 1080 wide at 4:5 shows 1350 of 1920 — 29.7% gone.
    expect(f.lostPct).toBeCloseTo(29.7, 1);
    expect(f.cropTop).toBeCloseTo(f.cropBottom, 6);
    expect(f.cropLeft).toBe(0);
  });

  it("is cropped the same way in an Instagram feed", () => {
    const f = fit(w, h, "instagram-feed");
    expect(f.mode).toBe("cropped");
    expect(f.axis).toBe("vertical");
    expect(f.renderedAspect).toBeCloseTo(0.8, 4);
  });

  it("says which edge and how much, not just that it is cropped", () => {
    const f = fit(w, h, "linkedin-feed");
    const msg = fitWarning(f, placementById("linkedin-feed")) as string;
    expect(msg).toContain("top and bottom");
    expect(msg).toContain("4:5");
    expect(msg).toContain("29.7%");
  });
});

describe("Montage — the reason previews are needed at all", () => {
  const { w, h, frames } = FORMATS.Montage; // 3240x1350, 3 frames

  it("previews as a frame, never as the strip", () => {
    expect(previewAssetSize(w, h, frames)).toEqual({ w: 1080, h: 1350 });
  });

  it("a single frame is 4:5 and fits every feed", () => {
    const f = previewAssetSize(w, h, frames);
    expect(fit(f.w, f.h, "linkedin-feed").mode).toBe("full");
    expect(fit(f.w, f.h, "instagram-feed").mode).toBe("full");
    expect(fit(f.w, f.h, "x-timeline").mode).toBe("full");
  });

  it("the whole 12:5 strip posted as one image is butchered", () => {
    const f = fit(w, h, "instagram-feed");
    expect(f.mode).toBe("cropped");
    expect(f.axis).toBe("horizontal");
    expect(f.severity).toBe("severe");
    expect(f.lostPct).toBeGreaterThan(20); // 2.4 -> 1.91 loses the outer edges
  });

  it("leaves an unframed format alone", () => {
    expect(previewAssetSize(1080, 1350, undefined)).toEqual({ w: 1080, h: 1350 });
    expect(previewAssetSize(1080, 1350, 1)).toEqual({ w: 1080, h: 1350 });
  });
});

describe("the formats that are already safe", () => {
  it("a 4:5 Carousel is full everywhere except the profile grid", () => {
    const { w, h } = FORMATS.Carousel;
    expect(fit(w, h, "linkedin-feed").mode).toBe("full");
    expect(fit(w, h, "instagram-feed").mode).toBe("full");
    expect(fit(w, h, "x-timeline").mode).toBe("full");

    const grid = fit(w, h, "instagram-grid");
    expect(grid.mode).toBe("cropped");
    expect(grid.axis).toBe("vertical");
    expect(grid.lostPct).toBeCloseTo(20, 1); // 1350 -> 1080
  });

  it("a 1:1 Square is full in the grid too", () => {
    const { w, h } = FORMATS.Square;
    expect(fit(w, h, "instagram-grid").mode).toBe("full");
  });

  it("a 16:9 Article Cover sits exactly on X's wide bound", () => {
    const { w, h } = FORMATS["Article Cover"];
    expect(fit(w, h, "x-timeline").mode).toBe("full");
    expect(fit(w, h, "linkedin-feed").mode).toBe("full");
  });

  it("every 4:5 studio format behaves identically in a LinkedIn feed", () => {
    const fourFive = (["Carousel", "Idea Deck", "Says vs Does", "Dialogue", "Video", "Founder Video"] as const);
    for (const id of fourFive) {
      const { w, h } = FORMATS[id];
      expect(fit(w, h, "linkedin-feed").mode, `${id} should post uncropped`).toBe("full");
    }
  });
});

describe("letterboxing keeps every pixel", () => {
  it("a 4:5 asset in a Story is boxed, not cropped", () => {
    const f = fit(1080, 1350, "instagram-story");
    expect(f.mode).toBe("letterboxed");
    expect(f.lostPct).toBe(0);
    expect(f.severity).toBe("minor");
    expect(fitWarning(f, placementById("instagram-story"))).toMatch(/inside bars/);
  });

  it("a document post shows any page whole", () => {
    expect(fit(1080, 1350, "linkedin-document").mode).toBe("full");
    expect(fit(1920, 1080, "linkedin-document").mode).toBe("full");
  });

  it("a full fit produces no warning at all", () => {
    expect(fitWarning(fit(1080, 1350, "linkedin-feed"), placementById("linkedin-feed"))).toBeNull();
  });
});

describe("caption truncation", () => {
  const long = "x".repeat(400);

  it("cuts LinkedIn at the see-more point", () => {
    const c = captionFit(long, placementById("linkedin-feed"));
    expect(c.truncated).toBe(true);
    expect(c.shown).toHaveLength(210);
    expect(c.hidden).toHaveLength(190);
  });

  it("cuts Instagram earlier", () => {
    expect(captionFit(long, placementById("instagram-feed")).shown).toHaveLength(125);
  });

  it("flags X as over the hard limit rather than truncating it", () => {
    const c = captionFit(long, placementById("x-timeline"));
    expect(c.truncated).toBe(false); // X rejects, it does not shorten
    expect(c.overLimit).toBe(true);
    expect(c.charCount).toBe(400);
  });

  it("leaves a short caption whole and unflagged", () => {
    const c = captionFit("A tight hook.", placementById("linkedin-feed"));
    expect(c.truncated).toBe(false);
    expect(c.hidden).toBe("");
    expect(c.overLimit).toBe(false);
  });

  it("survives an empty or missing caption", () => {
    expect(captionFit("", placementById("linkedin-feed")).charCount).toBe(0);
    expect(captionFit(undefined as unknown as string, placementById("x-timeline")).shown).toBe("");
  });
});

describe("describeAspect", () => {
  it("names the ratios the app actually produces", () => {
    expect(describeAspect(0.8)).toBe("4:5");
    expect(describeAspect(1)).toBe("1:1");
    expect(describeAspect(9 / 16)).toBe("9:16");
    expect(describeAspect(16 / 9)).toBe("16:9");
    expect(describeAspect(2.4)).toBe("12:5");
  });

  it("falls back to a decimal for anything unnamed", () => {
    expect(describeAspect(1.35)).toBe("1.35:1");
  });
});

describe("bad input", () => {
  it("refuses a zero or negative dimension instead of returning NaN", () => {
    expect(() => fit(0, 1350, "linkedin-feed")).toThrow(/positive dimensions/);
    expect(() => fit(1080, -1, "linkedin-feed")).toThrow(/positive dimensions/);
  });
});
