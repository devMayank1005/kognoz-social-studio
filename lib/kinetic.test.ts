import { describe, it, expect } from "vitest";
import { EASE, RISE_PX, animationCss, bezierAt, kineticTimeline, styleAt } from "./kinetic";
import { frameCount, webmMimeType } from "./kineticVideo";

// The timing used to live as four hand-written CSS shorthands in the Video branch of
// components/Slide.tsx. It moved here so a recorder can ask what the slide looks like at a
// given moment — a question a CSS string cannot answer, and the reason that format could
// only ever export a poster frame.
//
// The values below are the literals that were in the renderer. They are asserted rather
// than described because the whole point of the move is that the preview and the recorded
// file cannot drift apart: if these change, the video stops matching what people saw.

describe("the sequence keeps the timing the slide already had", () => {
  const t = kineticTimeline(5, 3);

  it("brings the eyebrow in first", () => {
    expect(t.eyebrow).toMatchObject({ name: "kvFade", delay: 0.25, duration: 0.6 });
  });

  it("staggers the headline a word at a time from 0.7s", () => {
    expect(t.words.map((w) => w.delay)).toEqual([0.7, 0.84, 0.98, 1.12, 1.26]);
    expect(t.words.every((w) => w.name === "kvRise" && w.duration === 0.8)).toBe(true);
  });

  it("starts the beats once the headline has landed, half a second apart", () => {
    // bodyDelay = 0.7 + words * 0.14 + 0.4
    expect(t.beats.map((b) => b.delay)).toEqual([1.8, 2.3, 2.8]);
  });

  it("puts the footer last", () => {
    expect(t.foot.delay).toBe(3);
  });

  it("reports when everything has settled", () => {
    // The last beat ends at 2.8 + 0.9; the footer at 3 + 0.8.
    expect(t.duration).toBe(3.8);
  });

  it("rounds away binary floating point instead of emitting 1.1199999999999999", () => {
    // `0.7 + 3 * 0.14` is not 1.12 in a double, and that noise used to go straight into
    // the rendered CSS.
    for (const step of [...t.words, ...t.beats, t.foot, t.eyebrow]) {
      expect(String(step.delay).replace("-", "").split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
    }
  });

  it("copes with a headline of one word and a slide with no beats", () => {
    const bare = kineticTimeline(1, 0);
    expect(bare.words).toHaveLength(1);
    expect(bare.beats).toEqual([]);
    expect(bare.duration).toBeGreaterThan(0);
  });
});

describe("animationCss writes what the slide wrote by hand", () => {
  const t = kineticTimeline(3, 2);

  it("formats a rising word exactly as before", () => {
    expect(animationCss(t.words[0])).toBe("kvRise .8s cubic-bezier(.2,.75,.2,1) .7s backwards");
  });

  it("formats a fade exactly as before", () => {
    expect(animationCss(t.eyebrow)).toBe("kvFade .6s ease .25s backwards");
  });

  it("always ends `backwards`, never `forwards`", () => {
    // app/globals.css explains why: the keyframes are stripped from the export, so a
    // `forwards` animation with an inline opacity:0 would export a blank slide.
    for (const step of [t.eyebrow, ...t.words, ...t.beats, t.foot]) {
      expect(animationCss(step).endsWith(" backwards")).toBe(true);
      expect(animationCss(step)).not.toContain("forwards");
    }
  });
});

describe("bezierAt", () => {
  it("pins both ends", () => {
    expect(bezierAt(EASE, 0)).toBe(0);
    expect(bezierAt(EASE, 1)).toBe(1);
    expect(bezierAt(EASE, -1)).toBe(0);
    expect(bezierAt(EASE, 2)).toBe(1);
  });

  it("matches CSS `ease` at its midpoint", () => {
    // cubic-bezier(.25,.1,.25,1) at x=0.5 is ~0.802 — the curve's whole character is that
    // it is well past half way by the time it is half way through.
    expect(bezierAt(EASE, 0.5)).toBeCloseTo(0.802, 2);
  });

  it("never goes backwards", () => {
    let last = -1;
    for (let x = 0; x <= 1; x += 0.02) {
      const y = bezierAt(EASE, x);
      expect(y).toBeGreaterThanOrEqual(last);
      last = y;
    }
  });
});

describe("styleAt resolves a frame", () => {
  const t = kineticTimeline(4, 2);
  const word = t.words[2];

  it("holds the from-state before the delay, which is what `backwards` means", () => {
    expect(styleAt(word, 0)).toEqual({ opacity: 0, transform: `translateY(${RISE_PX}px)` });
  });

  it("settles once the step is over and stays settled", () => {
    expect(styleAt(word, word.delay + word.duration)).toEqual({ opacity: 1, transform: "translateY(0px)" });
    expect(styleAt(word, 999)).toEqual({ opacity: 1, transform: "translateY(0px)" });
  });

  it("is partway through in the middle, and eased rather than linear", () => {
    const mid = styleAt(word, word.delay + word.duration / 2);
    expect(mid.opacity).toBeGreaterThan(0);
    expect(mid.opacity).toBeLessThan(1);
    expect(mid.opacity).not.toBeCloseTo(0.5, 2);
  });

  it("gives a fade no transform, so it cannot fight the layout", () => {
    expect(styleAt(t.beats[0], t.beats[0].delay + 0.2).transform).toBe("none");
  });

  it("has every element settled by the reported duration", () => {
    // The recorder stops here; anything still moving would be cut off mid-motion.
    for (const step of [t.eyebrow, ...t.words, ...t.beats, t.foot]) {
      expect(styleAt(step, t.duration).opacity, step.name).toBe(1);
    }
  });
});

describe("what the recorder can promise the browser", () => {
  // Safari is a supported target (PRD, "Browser support") and its MediaRecorder does not
  // encode WebM at all — it emits MP4/H.264. Detecting that is the difference between
  // telling somebody which browser to use and handing them a zero-byte download.
  it("picks the best WebM the browser actually supports", () => {
    const only = (...ok: string[]) => ({ isTypeSupported: (t: string) => ok.includes(t) });
    expect(webmMimeType(only("video/webm;codecs=vp9", "video/webm;codecs=vp8"))).toBe("video/webm;codecs=vp9");
    expect(webmMimeType(only("video/webm;codecs=vp8", "video/webm"))).toBe("video/webm;codecs=vp8");
    expect(webmMimeType(only("video/webm"))).toBe("video/webm");
  });

  it("returns null where WebM cannot be encoded, rather than guessing", () => {
    expect(webmMimeType({ isTypeSupported: () => false })).toBeNull();
    expect(webmMimeType(undefined)).toBeNull();
  });

  it("counts frames including the hold at the end", () => {
    expect(frameCount(4, 30, 1)).toBe(150);
    expect(frameCount(0, 30, 0)).toBe(1);
  });
});
