import { describe, it, expect } from "vitest";
import { DESIGN_SETS, LOOK_SETS, lookLever, nextSetWithDifferentCards, type DesignSetId } from "./designSets";
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

  it("gives card formats the classic/glass register", () => {
    expect(lookLever(FORMATS["Stat Card"])).toBe("cards");
    expect(lookLever(FORMATS.Dialogue)).toBe("cards");
  });

  it("gives accent-only formats the accent", () => {
    expect(lookLever(FORMATS["Idea Deck"])).toBe("accent");
    expect(lookLever(FORMATS["Founder Video"])).toBe("accent");
  });

  it("reports the formats whose renderers hardcode their look", () => {
    for (const f of ["Says vs Does", "Montage", "Story", "Video"] as const) {
      expect(lookLever(FORMATS[f])).toBe("none");
    }
  });

  it("classifies every studio format", () => {
    for (const f of STUDIO_FORMATS) {
      expect(["layout", "cards", "accent", "none"]).toContain(lookLever(FORMATS[f]));
    }
  });

  it("treats idea decks as accent-only even though they are decks", () => {
    // Idea Deck has deck:true AND idea:true — the idea renderer ignores variants.
    expect(FORMATS["Idea Deck"].deck).toBe(true);
    expect(lookLever(FORMATS["Idea Deck"])).toBe("accent");
  });
});

describe("nextSetWithDifferentCards", () => {
  it("always lands on a set whose card register actually differs", () => {
    for (const from of LOOK_SETS) {
      const to = nextSetWithDifferentCards(from);
      expect(DESIGN_SETS[to].cards).not.toBe(DESIGN_SETS[from].cards);
    }
  });

  it("never returns the set it started from", () => {
    for (const from of LOOK_SETS) {
      expect(nextSetWithDifferentCards(from)).not.toBe(from);
    }
  });

  it("returns a real set for an unknown input rather than throwing", () => {
    const to = nextSetWithDifferentCards("nonsense" as DesignSetId);
    expect(LOOK_SETS).toContain(to);
  });

  it("flips on a single step, where cycling sets in order would not", () => {
    // editorial -> numeral is classic -> classic: visually identical on a Stat Card.
    expect(DESIGN_SETS.editorial.cards).toBe(DESIGN_SETS.numeral.cards);
    expect(DESIGN_SETS[nextSetWithDifferentCards("editorial")].cards).toBe("glass");
  });
});
