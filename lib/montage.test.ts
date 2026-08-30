import { describe, it, expect } from "vitest";
import { tokenise, splitAcrossFrames, frameRoles, headlineAlign, longestPhrase } from "./montage";

// The headline runs across the three Montage frames so a swipe reveals it a phrase at
// a time. Where it breaks is therefore visible on the finished asset, and two failures
// would be shipped straight to LinkedIn: a word cut in half across a swipe, and a
// half-open *emphasis* pair printing literal asterisks on the canvas.

const rejoin = (parts: string[]) => parts.filter(Boolean).join(" ");

describe("tokenise", () => {
  it("splits on whitespace", () => {
    expect(tokenise("Culture is what your people do")).toEqual(["Culture", "is", "what", "your", "people", "do"]);
  });

  it("keeps a multi-word emphasis span whole", () => {
    expect(tokenise("Culture is *what your people* do")).toEqual(["Culture", "is", "*what your people*", "do"]);
  });

  it("keeps a single emphasised word whole", () => {
    expect(tokenise("what your people *do*")).toEqual(["what", "your", "people", "*do*"]);
  });

  it("treats an unmatched asterisk as an ordinary character", () => {
    expect(tokenise("hello *world")).toEqual(["hello", "*world"]);
  });

  it("survives empty, whitespace and missing input", () => {
    expect(tokenise("")).toEqual([]);
    expect(tokenise("   \n  ")).toEqual([]);
    expect(tokenise(undefined as unknown as string)).toEqual([]);
  });

  it("collapses irregular spacing", () => {
    expect(tokenise("one   two\n\tthree")).toEqual(["one", "two", "three"]);
  });
});

describe("splitAcrossFrames", () => {
  it("always returns one phrase per frame", () => {
    expect(splitAcrossFrames("Culture is what your people do", 3)).toHaveLength(3);
    expect(splitAcrossFrames("", 3)).toEqual(["", "", ""]);
  });

  it("never breaks a word", () => {
    const parts = splitAcrossFrames("Culture is what your people do", 3);
    const words = "Culture is what your people do".split(" ");
    for (const p of parts) {
      for (const w of p.split(" ").filter(Boolean)) {
        expect(words, `"${w}" is not a whole word from the headline`).toContain(w);
      }
    }
  });

  it("loses nothing and reorders nothing", () => {
    const src = "Behaviour is the honest data and the structure is the cause";
    expect(rejoin(splitAcrossFrames(src, 3))).toBe(src);
  });

  it("balances the three phrases rather than dumping everything in one", () => {
    const parts = splitAcrossFrames("Culture is what your people do", 3);
    expect(parts.every((p) => p.length > 0)).toBe(true);
    const lengths = parts.map((p) => p.length);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(6);
  });

  it("never splits an emphasis pair across frames", () => {
    // A stray "*" reaching the renderer prints as an asterisk on the canvas.
    const src = "Culture is *what your people actually do* every single week";
    const parts = splitAcrossFrames(src, 3);
    for (const p of parts) {
      const stars = (p.match(/\*/g) || []).length;
      expect(stars % 2, `"${p}" has an unclosed emphasis marker`).toBe(0);
    }
    expect(parts.some((p) => p.includes("*what your people actually do*"))).toBe(true);
  });

  it("keeps a long emphasis span together even when it blows the budget", () => {
    const parts = splitAcrossFrames("*one continuous emphasised phrase that is very long indeed* tail", 3);
    expect(parts.some((p) => p.includes("*one continuous emphasised phrase that is very long indeed*"))).toBe(true);
    expect(rejoin(parts)).toContain("tail");
  });

  it("fills the first frame first when there are fewer words than frames", () => {
    // Leaving frame one blank and starting on frame two would look broken.
    expect(splitAcrossFrames("Two words", 3)).toEqual(["Two", "words", ""]);
    expect(splitAcrossFrames("Alone", 3)).toEqual(["Alone", "", ""]);
  });

  it("puts the overflow on the last frame rather than dropping it", () => {
    const src = "a b c d e f g h i j k l m n o p";
    const parts = splitAcrossFrames(src, 3);
    expect(rejoin(parts)).toBe(src);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("handles a headline that is one very long word", () => {
    const parts = splitAcrossFrames("Supercalifragilisticexpialidocious", 3);
    expect(parts[0]).toBe("Supercalifragilisticexpialidocious");
    expect(parts.slice(1)).toEqual(["", ""]);
  });

  it("works for frame counts other than three", () => {
    expect(splitAcrossFrames("one two three four", 2)).toHaveLength(2);
    expect(rejoin(splitAcrossFrames("one two three four", 4))).toBe("one two three four");
    expect(splitAcrossFrames("anything", 0)).toEqual([]);
  });

  it("a realistic Kognoz headline divides into three readable phrases", () => {
    const parts = splitAcrossFrames("The survey and the behaviour disagree every single quarter", 3);
    expect(parts.filter(Boolean)).toHaveLength(3);
    for (const p of parts) expect(p.trim()).toBe(p); // no stray leading or trailing space
  });
});

describe("frameRoles", () => {
  it("opens on the first frame and closes on the last", () => {
    expect(frameRoles(0, 3)).toEqual({ eyebrow: true, cta: false, logo: false });
    expect(frameRoles(1, 3)).toEqual({ eyebrow: false, cta: false, logo: false });
    expect(frameRoles(2, 3)).toEqual({ eyebrow: false, cta: true, logo: true });
  });

  it("signs the piece exactly once", () => {
    // Repeating the mark on every frame is what broke the continuous read.
    const logos = [0, 1, 2].filter((i) => frameRoles(i, 3).logo);
    expect(logos).toEqual([2]);
  });
});

// The headline is three phrases that have to read as one line spanning the strip.
// Two things do that: one size for all of them, and a spread that opens at the left
// margin and closes at the right instead of resetting in each frame's own gutter.
describe("headlineAlign", () => {
  it("opens the line, closes it, and centres the middle", () => {
    expect(headlineAlign(0, 3)).toBe("start");
    expect(headlineAlign(1, 3)).toBe("center");
    expect(headlineAlign(2, 3)).toBe("end");
  });

  it("spreads across any frame count, not just three", () => {
    expect([0, 1, 2, 3].map((i) => headlineAlign(i, 4))).toEqual(["start", "center", "center", "end"]);
    // A single frame both opens and closes the line; opening wins, so it is not
    // right-aligned against nothing.
    expect(headlineAlign(0, 1)).toBe("start");
  });

  it("clamps rather than returning something unusable out of range", () => {
    expect(headlineAlign(-1, 3)).toBe("start");
    expect(headlineAlign(9, 3)).toBe("end");
  });
});

describe("longestPhrase", () => {
  it("picks the phrase the shared size has to fit", () => {
    expect(longestPhrase(["Culture is", "what your people", "do"])).toBe("what your people");
  });

  it("returns the first of equals rather than flip-flopping", () => {
    expect(longestPhrase(["aaa", "bbb"])).toBe("aaa");
  });

  it("survives empty and sparse input", () => {
    expect(longestPhrase([])).toBe("");
    expect(longestPhrase(["", "", ""])).toBe("");
    expect(longestPhrase(["", "two words", ""])).toBe("two words");
  });

  it("pairs with splitAcrossFrames, so one size covers every frame", () => {
    const phrases = splitAcrossFrames("The survey and the behaviour disagree every quarter", 3);
    const widest = longestPhrase(phrases);
    for (const p of phrases) expect(p.length).toBeLessThanOrEqual(widest.length);
  });
});
