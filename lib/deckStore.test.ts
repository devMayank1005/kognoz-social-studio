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

  it("keeps EVERY optional typography field a text box can carry", () => {
    // The guard. A field missing from coerceElement is not an error — it is dropped, so the
    // property applies on screen, saves, and is gone on the next load with nothing saying
    // why. This is the same failure the shape library hit, in a different place.
    const styled = {
      id: "el_1",
      kind: "text",
      w: 100,
      h: 40,
      fontStyle: "italic",
      backgroundColor: "#FFE9A8",
      textDecorationLine: "underline line-through",
      textTransform: "uppercase",
      letterSpacing: -1.5,
      opacity: 0.6,
      textShadow: "0 2px 6px rgba(0,0,0,0.35)",
      webkitTextStroke: "2px #000",
      direction: "rtl"
    };
    const el = coerceElement(styled);
    expect(el).toMatchObject({
      fontStyle: "italic",
      backgroundColor: "#FFE9A8",
      textDecorationLine: "underline line-through",
      textTransform: "uppercase",
      letterSpacing: -1.5,
      opacity: 0.6,
      textShadow: "0 2px 6px rgba(0,0,0,0.35)",
      webkitTextStroke: "2px #000",
      direction: "rtl"
    });
  });

  it("leaves the optional fields absent rather than undefined when nothing set them", () => {
    // A deck should not grow a key for every style nobody used.
    const el = coerceElement({ id: "el_1", kind: "text", w: 10, h: 10, text: "Hi" })!;
    for (const key of ["fontStyle", "backgroundColor", "letterSpacing", "opacity", "direction"]) {
      expect(Object.prototype.hasOwnProperty.call(el, key), `${key} should be absent`).toBe(false);
    }
  });

  it("refuses a junk value rather than storing it", () => {
    const el = coerceElement({
      id: "el_1",
      kind: "text",
      w: 10,
      h: 10,
      fontStyle: "oblique",
      textTransform: "sideways",
      direction: "sideways",
      letterSpacing: "wide",
      opacity: 42
    })!;
    expect(el).not.toHaveProperty("fontStyle");
    expect(el).not.toHaveProperty("textTransform");
    expect(el).not.toHaveProperty("direction");
    expect(el).not.toHaveProperty("letterSpacing");
    // Out of range is clamped rather than dropped — it is a number, just a wrong one.
    expect(el).toMatchObject({ opacity: 1 });
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

describe("a gradient fill survives being stored", () => {
  // THE TRAP THIS GUARDS. A field that is not coerced here is not an error — it is dropped.
  // The shape draws, the deck saves, and the gradient is gone on the next load with nothing
  // saying why. That is exactly how the shape library lost its new kinds, and a gradient is
  // the more tempting version of the same mistake because the CSS string "obviously" fits.
  const shape = (fillGradient: unknown) => ({
    id: "el_1",
    kind: "rect",
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    fill: "#ffffff",
    stroke: "transparent",
    fillGradient
  });

  const read = (fillGradient: unknown) => {
    const el = coerceElement(shape(fillGradient));
    return el && el.kind !== "text" ? el.fillGradient : undefined;
  };

  const good = {
    type: "linear",
    angle: 90,
    stops: [
      { color: "#43afcd", at: 0 },
      { color: "#75a02f", at: 100 }
    ]
  };

  it("comes back intact after a round trip", () => {
    expect(read(good)).toEqual(good);
  });

  it("survives the JSON round trip the database actually performs", () => {
    const el = coerceElement(JSON.parse(JSON.stringify(shape(good))));
    expect(el && el.kind !== "text" ? el.fillGradient : null).toEqual(good);
  });

  it("caps the stop count rather than storing a thousand of them", () => {
    // The deck is one jsonb blob with a 4 MB autosave ceiling. A hand-edited row must not
    // be able to spend it on one shape.
    const many = { ...good, stops: Array.from({ length: 400 }, (_, i) => ({ color: "#000000", at: i % 100 })) };
    expect(read(many)!.stops.length).toBeLessThanOrEqual(8);
  });

  it("clamps a position that is off the gradient line", () => {
    const g = read({ ...good, stops: [{ color: "#000", at: -40 }, { color: "#fff", at: 900 }] })!;
    expect(g.stops.map((s) => s.at)).toEqual([0, 100]);
  });

  it("wraps an out-of-range angle to the direction it actually means", () => {
    // 9999 is 279 the long way round, not 0. Clamping to a bound first would fold it onto
    // a different direction, which is a wrong answer dressed up as a safe one.
    expect(read({ ...good, angle: 9999 })!.angle).toBe(279);
    expect(read({ ...good, angle: -90 })!.angle).toBe(270);
    expect(read({ ...good, angle: Number.NaN })!.angle).toBe(0);
  });

  it("drops a one-stop gradient WHOLE rather than storing it half-valid", () => {
    // A single stop is not a gradient and renders as nothing. Falling back to the solid
    // `fill`, which is still there, beats a shape that silently disappears.
    expect(read({ ...good, stops: [{ color: "#000", at: 0 }] })).toBeUndefined();
  });

  it("drops a stop with no colour, and then the gradient if too few are left", () => {
    expect(read({ ...good, stops: [{ color: "", at: 0 }, { color: "", at: 100 }] })).toBeUndefined();
  });

  it("refuses rubbish in the field without taking the shape down with it", () => {
    for (const junk of ["linear-gradient(90deg, #a, #b)", 42, [], {}, { stops: "no" }, null]) {
      expect(read(junk)).toBeUndefined();
    }
    // The shape itself still loads — one bad gradient never costs somebody the element.
    const el = coerceElement(shape("nonsense"));
    expect(el && el.kind !== "text" ? el.fill : null).toBe("#ffffff");
  });

  it("leaves the field absent entirely when nothing set it", () => {
    // Not `undefined` — absent. A deck should not grow a key for every style nobody used.
    const el = coerceElement({ id: "el_1", kind: "rect", w: 10, h: 10 });
    expect(el && "fillGradient" in el).toBe(false);
  });

  it("keeps alpha on a stop colour", () => {
    const g = read({ ...good, stops: [{ color: "rgba(0, 0, 0, 0.5)", at: 0 }, { color: "#fff", at: 100 }] })!;
    expect(g.stops[0].color).toBe("rgba(0, 0, 0, 0.5)");
  });
});

describe("the deck palette", () => {
  const withPalette = (palette: unknown) =>
    coerceStoredDeck({ ...deck(), palette } as unknown)?.palette;

  it("round-trips the colours somebody saved", () => {
    expect(withPalette(["#43afcd", "rgba(0, 0, 0, 0.5)"])).toEqual(["#43afcd", "rgba(0, 0, 0, 0.5)"]);
  });

  it("caps the list so it cannot bloat the deck blob", () => {
    expect(withPalette(Array.from({ length: 100 }, () => "#000000"))).toHaveLength(24);
  });

  it("drops entries that are not strings rather than storing holes", () => {
    expect(withPalette(["#43afcd", 42, null, ""])).toEqual(["#43afcd"]);
  });

  it("stays absent when there is no palette, so old decks load unchanged", () => {
    expect(coerceStoredDeck(deck())?.palette).toBeUndefined();
    expect(withPalette("not an array")).toBeUndefined();
    expect(withPalette([])).toBeUndefined();
  });
});

describe("slotKey survives storage", () => {
  // The same guard as every other optional field. A dropped slotKey does not throw — the
  // ejected element loads fine and the template text UNDER it stops hiding, so the slide
  // shows the old wording and the new copy stacked on top of each other, on reload only.
  const read = (patch: Record<string, unknown>) => {
    const el = coerceElement({ id: "el_1", kind: "text", w: 100, h: 40, ...patch });
    return el && el.kind === "text" ? el : null;
  };

  it("round-trips the key beside the slot kind", () => {
    const el = read({ from: "headline", slotKey: "journey-title-1" })!;
    expect(el.from).toBe("headline");
    expect(el.slotKey).toBe("journey-title-1");
  });

  it("survives the JSON round trip the database performs", () => {
    const raw = JSON.parse(JSON.stringify({ id: "el_1", kind: "text", w: 100, h: 40, from: "body", slotKey: "chip-2" }));
    const el = coerceElement(raw);
    expect(el && el.kind === "text" ? el.slotKey : null).toBe("chip-2");
  });

  it("loads a deck written before slotKey existed, unchanged", () => {
    const el = read({ from: "headline" })!;
    expect(el.from).toBe("headline");
    expect("slotKey" in el).toBe(false);
  });

  it("refuses a key on an element that is not an ejected slot", () => {
    // Without `from` there is no template text to hide, so a stray key means nothing and
    // would only be one more field to coerce wrongly later.
    const el = read({ slotKey: "orphan" })!;
    expect("slotKey" in el).toBe(false);
  });

  it("drops a key that is not a string rather than storing rubbish", () => {
    expect("slotKey" in read({ from: "headline", slotKey: 42 })!).toBe(false);
  });
});
