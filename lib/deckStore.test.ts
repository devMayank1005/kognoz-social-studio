import { describe, it, expect } from "vitest";
import {
  coerceElement,
  coerceElementMap,
  coerceStoredDeck,
  deckChanged,
  serialiseDeck,
  DECK_PAYLOAD_LIMIT,
  type StoredDeck
} from "./deckStore";
import { SHAPE_KINDS, SHAPE_LIBRARY } from "./shapeLibrary";

const deck = (patch: Partial<StoredDeck> = {}): StoredDeck => ({
  version: 1,
  format: "Carousel",
  eyebrow: "Behavioral Signal",
  cover: "Culture is what your people *do*",
  cta: "See how we read culture",
  slides: [{ title: "One", body: "Body" }],
  images: {},
  scales: {},
  imgOn: {},
  elements: {},
  updatedAt: "2026-09-21T00:00:00.000Z",
  ...patch
});

describe("coerceElement", () => {
  it("keeps a text element and fills in what is missing", () => {
    const el = coerceElement({ id: "el_1", kind: "text", x: 1, y: 2, w: 10, h: 20, text: "Hi" });
    expect(el).toMatchObject({ id: "el_1", kind: "text", text: "Hi", align: "left", lineHeight: 1.2 });
  });

  it("keeps the template slot only when it is one we know", () => {
    expect(coerceElement({ id: "a", kind: "text", w: 1, h: 1, from: "headline" })).toMatchObject({ from: "headline" });
    expect(coerceElement({ id: "a", kind: "text", w: 1, h: 1, from: "nonsense" })).not.toHaveProperty("from");
  });

  it("clamps opacity into range rather than trusting the file", () => {
    expect(coerceElement({ id: "a", kind: "rect", w: 5, h: 5, opacity: 9 })).toMatchObject({ opacity: 1 });
    expect(coerceElement({ id: "a", kind: "rect", w: 5, h: 5, opacity: -3 })).toMatchObject({ opacity: 0 });
  });

  it("keeps EVERY shape kind the library can draw", () => {
    // The guard for the nastiest failure this feature can have. This validator used to hold
    // its own hardcoded list of kinds, and a kind missing from it is not an error — the
    // element is dropped. So a shape would draw correctly, save correctly, and then be gone
    // on the next load, with nothing anywhere saying why. Nobody notices until they reload.
    for (const kind of SHAPE_KINDS) {
      const el = coerceElement({ id: "el_1", kind, x: 10, y: 20, w: 100, h: 80 });
      expect(el, `a stored ${kind} was dropped on load`).not.toBeNull();
      expect(el).toMatchObject({ kind });
    }
  });

  it("keeps every kind the picker can insert", () => {
    // The picker inserts by entry, and two entries can share a kind (Rectangle and Rounded).
    // This is the same guard from the other end: what the toolbar offers must be storable.
    for (const spec of SHAPE_LIBRARY) {
      const el = coerceElement({ id: "el_1", kind: spec.kind, w: spec.size.w, h: spec.size.h });
      expect(el, `${spec.label} inserts a ${spec.kind} that does not survive a reload`).not.toBeNull();
    }
  });

  it("drops what cannot be recovered by guessing", () => {
    expect(coerceElement({ kind: "text", w: 5, h: 5 })).toBeNull();           // no id
    expect(coerceElement({ id: "a", kind: "polygon", w: 5, h: 5 })).toBeNull(); // unknown kind
    expect(coerceElement({ id: "a", kind: "rect", w: 0, h: 0 })).toBeNull();    // no size
    expect(coerceElement(null)).toBeNull();
    expect(coerceElement("nope")).toBeNull();
  });
});

describe("coerceElementMap", () => {
  it("drops unreadable entries instead of failing the whole load", () => {
    const out = coerceElementMap({ 0: [{ id: "a", kind: "rect", w: 5, h: 5 }, { kind: "rect" }, null] });
    expect(out[0].map((e) => e.id)).toEqual(["a"]);
  });

  it("returns slides in z order", () => {
    const out = coerceElementMap({
      2: [
        { id: "b", kind: "rect", w: 5, h: 5, z: 9 },
        { id: "a", kind: "rect", w: 5, h: 5, z: 1 }
      ]
    });
    expect(out[2].map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("ignores keys that are not slide indices", () => {
    expect(coerceElementMap({ cover: [{ id: "a", kind: "rect", w: 5, h: 5 }] })).toEqual({});
  });
});

describe("coerceStoredDeck", () => {
  it("returns null for the empty seed row, so a first read is not mistaken for a deck", () => {
    expect(coerceStoredDeck({})).toBeNull();
    expect(coerceStoredDeck(null)).toBeNull();
    expect(coerceStoredDeck({ slides: [] })).toBeNull();
  });

  it("keeps inlined images and drops remote ones", () => {
    // A remote URL taints the export canvas; the app inlines every picture on the way in,
    // so anything else in the blob is corrupt and would break the download, not the load.
    const out = coerceStoredDeck({
      slides: [{ title: "t", body: "b" }],
      images: { cover: "data:image/png;base64,AAA", s0: "https://example.com/x.png", s1: 42 }
    });
    expect(Object.keys(out!.images)).toEqual(["cover"]);
  });

  it("clamps a per-slide text scale into the range the control offers", () => {
    const out = coerceStoredDeck({ slides: [{ title: "t", body: "" }], scales: { 0: 99, 1: 0.01, 2: 1.2 } });
    expect(out!.scales).toEqual({ 0: 3, 1: 0.2, 2: 1.2 });
  });
});

describe("serialiseDeck", () => {
  it("passes an ordinary deck", () => {
    const out = serialiseDeck(deck());
    expect(out.tooLarge).toBe(false);
    expect(out.bytes).toBeGreaterThan(0);
  });

  it("refuses a deck whose photos have outgrown the blob", () => {
    // One jsonb row re-sent on every autosave: a couple of big base64 photos turn each
    // save into a multi-megabyte upload, so this is reported rather than attempted.
    const huge = deck({ images: { cover: "data:image/png;base64," + "A".repeat(DECK_PAYLOAD_LIMIT) } });
    expect(serialiseDeck(huge).tooLarge).toBe(true);
  });
});

describe("deckChanged", () => {
  it("ignores the timestamp, so an idle tab does not rewrite the row forever", () => {
    expect(deckChanged(deck(), deck({ updatedAt: "2027-01-01T00:00:00.000Z" }))).toBe(false);
  });

  it("notices real edits", () => {
    expect(deckChanged(deck(), deck({ cover: "Something else" }))).toBe(true);
    expect(deckChanged(null, deck())).toBe(true);
  });
});
