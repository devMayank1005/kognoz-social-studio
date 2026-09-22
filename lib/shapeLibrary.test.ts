import { describe, it, expect } from "vitest";
import {
  SHAPE_GEOMETRY,
  SHAPE_LIBRARY,
  SHAPE_CATEGORIES,
  SHAPE_KINDS,
  STROKE_ONLY,
  isShapeKind,
  pathFor,
  searchShapes,
  shapeEntry,
  type ShapeKind
} from "./shapeLibrary";

/** Every number a path mentions, so a NaN or an Infinity cannot hide in the string. */
function numbersIn(path: string): number[] {
  return (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

const BOXES: [number, number][] = [
  [300, 300],
  [420, 240],
  [6, 900],
  [1080, 1350],
  [1, 1],
  // Degenerate on purpose: a line is 6px tall and a resize can pass through zero.
  [200, 0],
  [0, 0]
];

describe("the geometry", () => {
  it("covers every kind the type allows", () => {
    // Record<ShapeKind, …> makes TypeScript enforce this, but the test states it so that a
    // kind added with a cast rather than a real implementation still fails.
    expect(SHAPE_KINDS.length).toBeGreaterThanOrEqual(34);
    expect(new Set(SHAPE_KINDS).size).toBe(SHAPE_KINDS.length);
  });

  for (const kind of Object.keys(SHAPE_GEOMETRY) as ShapeKind[]) {
    describe(kind, () => {
      it("draws something at every box size, with no NaN or Infinity", () => {
        for (const [w, h] of BOXES) {
          const d = SHAPE_GEOMETRY[kind](w, h);
          expect(d.length, `${kind} at ${w}x${h} drew nothing`).toBeGreaterThan(0);
          expect(d.startsWith("M"), `${kind} must start with a moveto`).toBe(true);
          for (const value of numbersIn(d)) {
            expect(Number.isFinite(value), `${kind} at ${w}x${h} emitted ${value}`).toBe(true);
          }
        }
      });

      it("actually scales with the box", () => {
        // Catches a path accidentally written with hardcoded coordinates, which would look
        // right at one size and wrong at every other.
        expect(SHAPE_GEOMETRY[kind](300, 300)).not.toBe(SHAPE_GEOMETRY[kind](600, 600));
      });

      it("stays inside its box", () => {
        // Bezier control points may sit outside — that is how a heart gets its lobes — so
        // this is a loose bound, catching a shape drawn at the wrong scale entirely.
        const [w, h] = [400, 300];
        for (const value of numbersIn(SHAPE_GEOMETRY[kind](w, h))) {
          expect(Math.abs(value)).toBeLessThanOrEqual(Math.max(w, h) * 1.3);
        }
      });
    });
  }
});

describe("pathFor", () => {
  it("falls back to a rectangle rather than drawing nothing", () => {
    // A deck written by a future version could carry a kind this build does not know.
    // An empty path is an invisible element somebody cannot find or delete.
    expect(pathFor("notAShape" as ShapeKind, 100, 50)).toBe(SHAPE_GEOMETRY.rect(100, 50));
  });
});

describe("isShapeKind", () => {
  it("accepts every real kind and nothing else", () => {
    for (const kind of SHAPE_KINDS) expect(isShapeKind(kind)).toBe(true);
    for (const junk of ["", "rectangle", "RECT", null, 7, {}, "constructor", "toString"]) {
      expect(isShapeKind(junk), `${String(junk)} should not be a kind`).toBe(false);
    }
  });
});

describe("the picker's entries", () => {
  it("has a unique id for each", () => {
    const ids = SHAPE_LIBRARY.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only references kinds that have geometry", () => {
    for (const spec of SHAPE_LIBRARY) {
      expect(isShapeKind(spec.kind), `${spec.id} points at ${spec.kind}`).toBe(true);
    }
  });

  it("gives every entry a positive insert size", () => {
    for (const spec of SHAPE_LIBRARY) {
      expect(spec.size.w, spec.id).toBeGreaterThan(0);
      expect(spec.size.h, spec.id).toBeGreaterThan(0);
    }
  });

  it("puts every entry in a category the picker renders", () => {
    const known = new Set(SHAPE_CATEGORIES.map((c) => c.id));
    for (const spec of SHAPE_LIBRARY) {
      expect(known.has(spec.category), `${spec.id} is in ${spec.category}`).toBe(true);
    }
  });

  it("leaves no category empty", () => {
    for (const cat of SHAPE_CATEGORIES) {
      expect(SHAPE_LIBRARY.some((s) => s.category === cat.id), `${cat.id} is empty`).toBe(true);
    }
  });

  it("keeps the three original shapes, so old decks still have their entries", () => {
    for (const id of ["rect", "ellipse", "line"]) {
      expect(shapeEntry(id), id).toBeDefined();
    }
    expect(STROKE_ONLY.has("line")).toBe(true);
  });

  it("is about the size we said", () => {
    expect(SHAPE_LIBRARY.length).toBeGreaterThanOrEqual(30);
  });
});

describe("searchShapes", () => {
  it("returns everything for an empty query", () => {
    expect(searchShapes("")).toHaveLength(SHAPE_LIBRARY.length);
    expect(searchShapes("   ")).toHaveLength(SHAPE_LIBRARY.length);
  });

  it("matches the label, case-insensitively", () => {
    expect(searchShapes("HEXAGON").map((s) => s.id)).toContain("hexagon");
  });

  it("matches keywords, which is the point of having them", () => {
    // Nobody types "balloonRound" — they type "bubble".
    expect(searchShapes("bubble").map((s) => s.id)).toContain("balloonRound");
    expect(searchShapes("database").map((s) => s.id)).toContain("cylinder");
    expect(searchShapes("sale").map((s) => s.id)).toContain("burst");
  });

  it("returns nothing for a query that matches nothing", () => {
    expect(searchShapes("zzzzz")).toHaveLength(0);
  });
});
