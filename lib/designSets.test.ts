import { describe, it, expect } from "vitest";
import { DESIGN_SETS, LOOK_SETS, lookLever, nextSetWithDifferentCards, isDarkRegister, type DesignSetId } from "./designSets";
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

  it("leaves only Video without a look to cycle", () => {
    expect(lookLever(FORMATS.Video)).toBe("none");
    const stuck = STUDIO_FORMATS.filter((f) => lookLever(FORMATS[f]) === "none");
    expect(stuck).toEqual(["Video"]);
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

describe("isDarkRegister", () => {
  it("is fixed for sets that pin their card register", () => {
    // These do not depend on seed at all.
    for (const seed of [0, 1, 2, 3, 7]) {
      expect(isDarkRegister("dark", seed)).toBe(true);
      expect(isDarkRegister("glass", seed)).toBe(true);
      expect(isDarkRegister("editorial", seed)).toBe(false);
      expect(isDarkRegister("bloom", seed)).toBe(false);
    }
  });

  it("alternates on seed for the mixed set — the case that looked stuck", () => {
    // "mixed" has cards: null, so the register flips with the seed while the SET
    // name never changes. Labelling the set made the button appear frozen.
    expect(isDarkRegister("mixed", 0)).toBe(false);
    expect(isDarkRegister("mixed", 1)).toBe(true);
    expect(isDarkRegister("mixed", 2)).toBe(false);
    expect(isDarkRegister("mixed", 3)).toBe(true);
  });

  it("changes on every seed bump for mixed, so the label must too", () => {
    const seq = [0, 1, 2, 3, 4, 5].map((n) => isDarkRegister("mixed", n));
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
  });

  it("falls back to editorial for an unknown or missing set", () => {
    expect(isDarkRegister(undefined, 1)).toBe(false);
    expect(isDarkRegister(null, 1)).toBe(false);
    expect(isDarkRegister("nonsense" as DesignSetId, 1)).toBe(false);
  });

  it("agrees with DESIGN_SETS for every set at a fixed seed", () => {
    for (const id of Object.keys(DESIGN_SETS) as DesignSetId[]) {
      const cards = DESIGN_SETS[id].cards;
      if (cards === "glass") expect(isDarkRegister(id, 0)).toBe(true);
      if (cards === "classic") expect(isDarkRegister(id, 0)).toBe(false);
    }
  });
});
