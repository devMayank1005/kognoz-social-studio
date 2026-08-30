import { describe, it, expect } from "vitest";
import {
  deckIndexOfSlide,
  shiftSlideImages,
  shiftDeckMap,
  currentAfterRemoval,
  frameWidth,
  frameBounds,
  columnsRespectFrames,
  exportFileCount
} from "./slideIndex";
import { FORMATS } from "./formats";

describe("removing a slide keeps its side data aligned", () => {
  it("drops the removed slide's photo and pulls later ones down", () => {
    const images = { cover: "C", s0: "A", s1: "B", s2: "D" };
    expect(shiftSlideImages(images, 1)).toEqual({ cover: "C", s0: "A", s1: "D" });
  });

  it("leaves non-positional keys alone", () => {
    const images = { article: "A", story: "S", m0: "M0", m2: "M2", s0: "X" };
    expect(shiftSlideImages(images, 0)).toEqual({ article: "A", story: "S", m0: "M0", m2: "M2" });
  });

  it("shifts the deck-keyed maps by deck index, not slide index", () => {
    // Carousel: cover=0, slide0=1, slide1=2, slide2=3. Removing slide 1 removes deck 2.
    const scales = { 0: 1.2, 1: 0.9, 2: 1.4, 3: 1.1 };
    expect(shiftDeckMap(scales, deckIndexOfSlide(1, true))).toEqual({ 0: 1.2, 1: 0.9, 2: 1.1 });
  });

  it("does not offset the cover on single formats", () => {
    expect(deckIndexOfSlide(0, false)).toBe(0);
    expect(deckIndexOfSlide(0, true)).toBe(1);
  });

  it("moves the preview back when the removed slide was before it", () => {
    expect(currentAfterRemoval(4, 2)).toBe(3);
    expect(currentAfterRemoval(1, 2)).toBe(1);
    expect(currentAfterRemoval(2, 2)).toBe(2);
  });

  it("a photo stays with its own slide across a removal", () => {
    // Slide 2's photo must still be slide 2's photo after slide 0 goes.
    const before = { s0: "zero", s1: "one", s2: "two" };
    const after = shiftSlideImages(before, 0);
    expect(after.s1).toBe("two"); // old s2 is now slide 1
    expect(after.s0).toBe("one");
    expect(after.s2).toBeUndefined();
  });
});

describe("montage frame geometry", () => {
  const { w, frames } = FORMATS.Montage;

  it("montage is an exact whole number of frames wide", () => {
    expect(frames).toBe(3);
    expect(w % (frames as number)).toBe(0);
    expect(frameWidth(w, frames as number)).toBe(1080);
  });

  it("frames tile the canvas with no gap and no overlap", () => {
    const b = frameBounds(w, frames as number);
    expect(b[0]).toEqual({ start: 0, end: 1080 });
    expect(b[1]).toEqual({ start: 1080, end: 2160 });
    expect(b[2]).toEqual({ start: 2160, end: 3240 });
  });

  it("rejects the old layout, where card three crossed the second cut", () => {
    // Cards froze at maxWidth 900 inside 100px padding with a 120px gap.
    const old = [
      { start: 100, end: 1000 },
      { start: 1120, end: 2020 },
      { start: 2140, end: 3040 } // starts 20px before the cut at 2160
    ];
    expect(columnsRespectFrames(old, w, frames as number)).toBe(false);
  });

  it("accepts equal columns, which is what the renderer now builds", () => {
    const fw = frameWidth(w, frames as number);
    const now = [0, 1, 2].map((i) => ({ start: i * fw, end: (i + 1) * fw }));
    expect(columnsRespectFrames(now, w, frames as number)).toBe(true);
  });
});

describe("how many files a download actually writes", () => {
  it("counts frame slices, not deck entries", () => {
    // Montage is one deck entry that writes three PNGs — the button said "1".
    expect(exportFileCount(1, 3)).toBe(3);
  });

  it("is the deck length when a format has no frames", () => {
    expect(exportFileCount(8, undefined)).toBe(8);
  });
});
