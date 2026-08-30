import { describe, it, expect } from "vitest";
import { DESIGN_SETS, LOOK_SETS, SURFACE_ORDER, SURFACE_LABELS, surfaceFor, isDarkSurface, lookLever, nextCardSet, type DesignSetId } from "./designSets";
import { FORMATS, STUDIO_FORMATS } from "./formats";

// "Next look" appeared broken on Idea Deck, Stat Card, Says vs Does, Montage and
// Founder Video. The button worked; a DesignSetSpec only carries cover/contents/
// cards, so those formats had no way to express a set change. These lock in which
// dimension each format can actually show.

describe("lookLever", () => {
  it("gives decks the full layout cycle", () => {
    expect(lookLever(FORMATS.Carousel)).toBe("layout");
    expect(lookLever(FORMATS.Square)).toBe("layout");
    expect(lookLever(FORMATS["Article Cover"])).toBe("layout");
  });

  it("gives every single-asset format the light/dark register", () => {
    // Each of these now renders both registers off dset.cards.
    for (const f of ["Stat Card", "Dialogue", "Says vs Does", "Montage", "Story", "Founder Video"] as const) {
      expect(lookLever(FORMATS[f])).toBe("cards");
    }
  });

  it("gives idea decks the register too, now that the stash renders dark", () => {
    expect(lookLever(FORMATS["Idea Deck"])).toBe("cards");
  });

  it("gives every studio format a look to cycle", () => {
    // This test previously asserted Video had NO look — which quietly documented
    // a deleted renderer as intended behaviour and hid the bug from review.
    // Video is surface-driven like the rest now, so nothing should be stuck.
    const stuck = STUDIO_FORMATS.filter((f) => lookLever(FORMATS[f]) === "none");
    expect(stuck).toEqual([]);
  });

  it("gives Video the card register, like the other single-asset formats", () => {
    expect(lookLever(FORMATS.Video)).toBe("cards");
  });

  it("classifies every studio format", () => {
    for (const f of STUDIO_FORMATS) {
      expect(["layout", "cards", "accent", "none"]).toContain(lookLever(FORMATS[f]));
    }
  });

  it("routes idea decks by their idea renderer, not the generic deck path", () => {
    // Idea Deck has deck:true AND idea:true; the idea renderer ignores the deck
    // cover/content variant lists, so it must not be classified as "layout".
    expect(FORMATS["Idea Deck"].deck).toBe(true);
    expect(lookLever(FORMATS["Idea Deck"])).toBe("cards");
  });
});

describe("surfaceFor — the fix for six sets rendering two looks", () => {
  it("gives every design set its own distinct surface", () => {
    // The bug: single-asset formats only read dset.cards, so editorial/numeral/
    // bloom/magazine were all one light look and dark/glass were one dark look.
    const surfaces = LOOK_SETS.map((id) => surfaceFor(id, 0));
    expect(new Set(surfaces).size).toBe(LOOK_SETS.length);
  });

  it("is stable for a real set regardless of seed", () => {
    for (const seed of [0, 1, 2, 5, 11]) {
      expect(surfaceFor("editorial", seed)).toBe("paper");
      expect(surfaceFor("magazine", seed)).toBe("press");
    }
  });

  it("rotates surfaces on the seed for Mixed, which is what makes it max variety", () => {
    const seen = [0, 1, 2, 3, 4, 5].map((n) => surfaceFor("mixed", n));
    expect(new Set(seen).size).toBe(SURFACE_ORDER.length);
  });

  it("changes surface on every seed bump for Mixed", () => {
    for (let n = 0; n < 12; n++) expect(surfaceFor("mixed", n)).not.toBe(surfaceFor("mixed", n + 1));
  });

  it("falls back to paper for an unknown or missing set", () => {
    // A missing set behaves like Mixed and rotates; a set we simply do not know
    // falls back to the default surface rather than rotating unpredictably.
    expect(surfaceFor(undefined, 0)).toBe(SURFACE_ORDER[0]);
    expect(surfaceFor("nonsense" as DesignSetId, 3)).toBe("paper");
  });

  it("marks exactly the two dark surfaces as dark", () => {
    const dark = SURFACE_ORDER.filter(isDarkSurface);
    expect(dark).toEqual(["boardroom", "glass"]);
  });

  it("names every surface for the button label", () => {
    for (const id of SURFACE_ORDER) expect(SURFACE_LABELS[id]).toBeTruthy();
  });
});

describe("nextCardSet", () => {
  it("walks every design set in order", () => {
    const seen = Array.from({ length: LOOK_SETS.length }, (_, i) => nextCardSet(i));
    expect(seen).toEqual(LOOK_SETS);
  });

  it("lands on a different surface on every consecutive press", () => {
    // This is the property the user actually cares about: one click, one new look.
    for (let i = 0; i < 12; i++) {
      expect(surfaceFor(nextCardSet(i), 0)).not.toBe(surfaceFor(nextCardSet(i + 1), 0));
    }
  });

  it("wraps instead of running off the end, and survives a negative step", () => {
    expect(nextCardSet(LOOK_SETS.length)).toBe(LOOK_SETS[0]);
    expect(LOOK_SETS).toContain(nextCardSet(-1));
  });

  it("never auto-selects Mixed, which is a deliberate user choice", () => {
    for (let i = 0; i < 20; i++) expect(nextCardSet(i)).not.toBe("mixed");
  });
});

