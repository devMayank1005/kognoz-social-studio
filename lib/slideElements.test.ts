import { describe, it, expect } from "vitest";
import {
  normaliseRotation,
  nextElementId,
  nextZ,
  createText,
  createShape,
  clampToCanvas,
  moveBy,
  rotateTo,
  resizeBy,
  centerOf,
  sortByZ,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
  snapPosition,
  hiddenSlots,
  resetSlot,
  applyRegenerate,
  updateElement,
  removeElement,
  fontFamiliesUsed,
  MIN_SIZE,
  containsPoint,
  hitTest,
  cornersOf,
  boundsOf,
  type SlideElement,
  type TextElement,
  type Handle
} from "./slideElements";

const text = (patch: Partial<TextElement> = {}): TextElement => ({
  ...createText([], patch),
  ...patch
});

/** A box corner in world space, accounting for rotation about the centre. */
function corner(el: { x: number; y: number; w: number; h: number; rot: number }, which: "nw" | "ne" | "se" | "sw") {
  const c = centerOf(el);
  const sx = which === "nw" || which === "sw" ? -1 : 1;
  const sy = which === "nw" || which === "ne" ? -1 : 1;
  const lx = (sx * el.w) / 2;
  const ly = (sy * el.h) / 2;
  const r = (el.rot * Math.PI) / 180;
  return { x: c.x + lx * Math.cos(r) - ly * Math.sin(r), y: c.y + lx * Math.sin(r) + ly * Math.cos(r) };
}

const OPPOSITE: Record<string, "nw" | "ne" | "se" | "sw"> = { se: "nw", nw: "se", ne: "sw", sw: "ne" };

describe("normaliseRotation", () => {
  it("brings any angle into (-180, 180]", () => {
    expect(normaliseRotation(0)).toBe(0);
    expect(normaliseRotation(370)).toBe(10);
    expect(normaliseRotation(-370)).toBe(-10);
    expect(normaliseRotation(180)).toBe(180);
    expect(normaliseRotation(-180)).toBe(180);
    expect(normaliseRotation(540)).toBe(180);
  });

  it("never returns -0, which would not compare equal to 0", () => {
    expect(Object.is(normaliseRotation(-360), 0)).toBe(true);
  });
});

describe("nextElementId", () => {
  it("is derived from what is present, not from a clock", () => {
    expect(nextElementId([])).toBe("el_1");
    expect(nextElementId([text({ id: "el_1" }), text({ id: "el_2" })])).toBe("el_3");
  });

  it("does not reuse an id after a deletion in the middle", () => {
    expect(nextElementId([text({ id: "el_1" }), text({ id: "el_7" })])).toBe("el_8");
  });

  it("ignores ids that are not ours", () => {
    expect(nextElementId([text({ id: "imported" })])).toBe("el_1");
  });
});

describe("factories", () => {
  it("stacks a new element above everything present", () => {
    const els = [text({ id: "el_1", z: 4 })];
    expect(nextZ(els)).toBe(5);
    expect(createText(els).z).toBe(5);
    expect(createShape(els, "rect").z).toBe(5);
  });

  it("gives a line a stroke and no fill, and a rect the reverse", () => {
    const line = createShape([], "line");
    expect(line.fill).toBe("transparent");
    expect(line.strokeWidth).toBeGreaterThan(0);
    const rect = createShape([], "rect");
    expect(rect.fill).not.toBe("transparent");
    expect(rect.strokeWidth).toBe(0);
  });
});

describe("clampToCanvas", () => {
  it("always leaves a grabbable sliver on the canvas", () => {
    const far = clampToCanvas(text({ x: 5000, y: 9000, w: 200, h: 100 }), 1080, 1350);
    expect(far.x).toBeLessThan(1080);
    expect(far.y).toBeLessThan(1350);
    const off = clampToCanvas(text({ x: -5000, y: -9000, w: 200, h: 100 }), 1080, 1350);
    expect(off.x + 200).toBeGreaterThan(0);
    expect(off.y + 100).toBeGreaterThan(0);
  });

  it("leaves an element that is already on the canvas alone", () => {
    const el = text({ x: 100, y: 200, w: 300, h: 80 });
    expect(clampToCanvas(el, 1080, 1350)).toMatchObject({ x: 100, y: 200 });
  });
});

describe("resizeBy — unrotated", () => {
  const el = text({ x: 100, y: 100, w: 200, h: 100, rot: 0 });

  it("pins the opposite edge when dragging an edge grip", () => {
    const e = resizeBy(el, "e", 50, 0);
    expect(e).toMatchObject({ x: 100, w: 250 });   // left edge unmoved
    const w = resizeBy(el, "w", -50, 0);
    expect(w).toMatchObject({ x: 50, w: 250 });    // right edge still at 300
    expect(w.x + w.w).toBe(300);
    const s = resizeBy(el, "s", 0, 40);
    expect(s).toMatchObject({ y: 100, h: 140 });
    const n = resizeBy(el, "n", 0, -40);
    expect(n.y + n.h).toBe(200);                   // bottom edge still at 200
  });

  it("pins the opposite corner when dragging a corner grip", () => {
    const se = resizeBy(el, "se", 50, 25);
    expect(se).toMatchObject({ x: 100, y: 100, w: 250, h: 125 });
  });

  it("refuses to shrink below the minimum, and does not drift while clamped", () => {
    const tiny = resizeBy(el, "e", -9999, 0);
    expect(tiny.w).toBe(MIN_SIZE);
    expect(tiny.x).toBe(100); // west edge still pinned
  });

  it("keeps the aspect ratio on a corner drag when asked", () => {
    const r = resizeBy(el, "se", 100, 0, { lockAspect: true });
    expect(r.w / r.h).toBeCloseTo(el.w / el.h, 5);
  });
});

describe("resizeBy — rotated", () => {
  // The bug this guards: applying a world-space delta to a rotated box without moving into
  // its local frame makes the box drift sideways as you drag. It is invisible at rot 0.
  for (const rot of [30, -45, 90, 175]) {
    for (const handle of ["se", "nw", "ne", "sw"] as Handle[]) {
      it(`keeps the pinned corner still at ${rot}deg dragging ${handle}`, () => {
        const el = text({ x: 300, y: 200, w: 240, h: 120, rot });
        const before = corner(el, OPPOSITE[handle]);
        const after = resizeBy(el, handle, 37, -19);
        const moved = corner(after, OPPOSITE[handle]);
        // Geometry is rounded to 2dp before it is stored, so the pinned corner can sit up
        // to a rounding step away. A genuine local-frame bug moves it by tens of pixels,
        // not hundredths — anything under a twentieth of a pixel is the rounding, not drift.
        expect(Math.abs(moved.x - before.x)).toBeLessThan(0.05);
        expect(Math.abs(moved.y - before.y)).toBeLessThan(0.05);
      });
    }
  }

  it("grows along the element's own axis, not the screen's", () => {
    // At 90deg the element's local +x points along world +y, so a downward world drag on
    // the east grip must widen it.
    const el = text({ x: 300, y: 200, w: 200, h: 100, rot: 90 });
    const grown = resizeBy(el, "e", 0, 60);
    expect(grown.w).toBeCloseTo(260, 4);
    expect(grown.h).toBeCloseTo(100, 4);
  });
});

describe("z-order", () => {
  const a = text({ id: "el_1", z: 1 });
  const b = text({ id: "el_2", z: 2 });
  const c = text({ id: "el_3", z: 3 });
  const ids = (els: SlideElement[]) => sortByZ(els).map((e) => e.id);

  it("moves one step at a time", () => {
    expect(ids(bringForward([a, b, c], "el_1"))).toEqual(["el_2", "el_1", "el_3"]);
    expect(ids(sendBackward([a, b, c], "el_3"))).toEqual(["el_1", "el_3", "el_2"]);
  });

  it("goes all the way with front and back", () => {
    expect(ids(bringToFront([a, b, c], "el_1"))).toEqual(["el_2", "el_3", "el_1"]);
    expect(ids(sendToBack([a, b, c], "el_3"))).toEqual(["el_3", "el_1", "el_2"]);
  });

  it("stays put at the ends rather than wrapping round", () => {
    expect(ids(bringForward([a, b, c], "el_3"))).toEqual(["el_1", "el_2", "el_3"]);
    expect(ids(sendBackward([a, b, c], "el_1"))).toEqual(["el_1", "el_2", "el_3"]);
  });

  it("renumbers so z never drifts into gaps", () => {
    const out = bringForward([text({ id: "el_1", z: 5 }), text({ id: "el_2", z: 90 })], "el_1");
    expect(sortByZ(out).map((e) => e.z)).toEqual([1, 2]);
  });

  it("orders two elements sharing a z stably, so neither flickers", () => {
    const tied = [text({ id: "el_2", z: 1 }), text({ id: "el_1", z: 1 })];
    expect(ids(tied)).toEqual(["el_1", "el_2"]);
  });
});

describe("snapPosition", () => {
  const box = { x: 100, y: 100, w: 200, h: 100, rot: 0, id: "el_9" };

  it("snaps to the canvas centre line", () => {
    const near = { ...box, x: 1080 / 2 - 200 / 2 + 3 };
    const r = snapPosition(near, [], 1080, 1350);
    expect(r.x + near.w / 2).toBeCloseTo(540, 5);
    expect(r.guides).toContainEqual({ axis: "x", at: 540 });
  });

  it("snaps to a sibling's edge", () => {
    const sibling = text({ id: "el_1", x: 400, y: 600, w: 100, h: 100 });
    const r = snapPosition({ ...box, x: 396 }, [sibling], 1080, 1350);
    expect(r.x).toBe(400);
  });

  it("ignores itself when looking for neighbours", () => {
    const self = text({ id: "el_9", x: 100, y: 100, w: 200, h: 100 });
    const r = snapPosition({ ...box, x: 137 }, [self], 1080, 1350);
    expect(r.x).toBe(137);
  });

  it("does nothing beyond the tolerance", () => {
    const r = snapPosition({ ...box, x: 300 }, [], 1080, 1350, 8);
    expect(r).toMatchObject({ x: 300, y: 100 });
  });

  it("does not snap a rotated element, whose edges are not axis-aligned", () => {
    const r = snapPosition({ ...box, x: 3, rot: 12 }, [], 1080, 1350);
    expect(r).toMatchObject({ x: 3, guides: [] });
  });
});

describe("template ejection", () => {
  const ejected = text({ id: "el_1", from: "headline" });
  const added = text({ id: "el_2" });
  const shape = createShape([], "rect", { id: "el_3" });

  it("reports which template slots the renderer must not draw", () => {
    expect(hiddenSlots([ejected, added, shape])).toEqual(new Set(["headline"]));
  });

  it("resetting a slot removes only that element", () => {
    const out = resetSlot([ejected, added], "headline");
    expect(out.map((e) => e.id)).toEqual(["el_2"]);
  });

  it("a regenerate keeps what you added and drops what was ejected", () => {
    // The ejected copy holds text the model has just replaced; keeping it would leave the
    // old wording on the slide beside the new.
    const out = applyRegenerate([ejected, added, shape]);
    expect(out.map((e) => e.id)).toEqual(["el_2", "el_3"]);
    expect(out.map((e) => e.z)).toEqual([1, 2]);
  });
});

describe("collection helpers", () => {
  it("updates one element and leaves the rest identical", () => {
    const a = text({ id: "el_1" });
    const b = text({ id: "el_2" });
    const out = updateElement([a, b], "el_1", (el) => moveBy(el, 10, 10));
    expect(out[0]).toMatchObject({ x: a.x + 10, y: a.y + 10 });
    expect(out[1]).toBe(b);
  });

  it("removing renumbers what is left", () => {
    const out = removeElement([text({ id: "el_1", z: 1 }), text({ id: "el_2", z: 2 }), text({ id: "el_3", z: 3 })], "el_2");
    expect(out.map((e) => [e.id, e.z])).toEqual([["el_1", 1], ["el_3", 2]]);
  });

  it("lists the font families in use, so the exporter embeds those and only those", () => {
    const els = [text({ id: "el_1", fontFamily: "Poppins" }), text({ id: "el_2", fontFamily: "Poppins" }), createShape([], "rect", { id: "el_3" })];
    expect(fontFamiliesUsed(els)).toEqual(["Poppins"]);
  });
});

describe("rotateTo", () => {
  it("snaps to a step when one is given", () => {
    expect(rotateTo(text(), 43, 15).rot).toBe(45);
    expect(rotateTo(text(), 43).rot).toBe(43);
  });
});

describe("hit testing", () => {
  const box = text({ id: "el_1", x: 100, y: 100, w: 200, h: 100, rot: 0 });

  it("uses the element's own frame, not its bounding box", () => {
    const turned = { ...box, rot: 45 };
    // The unrotated corner (100,100) is outside a 45deg-rotated box, though it is still
    // inside that box's axis-aligned bounds. Testing bounds would select on empty space.
    expect(containsPoint(turned, 101, 101, 0)).toBe(false);
    expect(containsPoint(turned, 200, 150, 0)).toBe(true);
  });

  it("gives thin shapes a few pixels of forgiveness", () => {
    const line = createShape([], "line", { id: "el_2", x: 0, y: 100, w: 300, h: 4 });
    expect(containsPoint(line, 150, 108, 0)).toBe(false);
    expect(containsPoint(line, 150, 108, 6)).toBe(true);
  });

  it("returns the topmost element under the point", () => {
    const under = text({ id: "el_1", x: 0, y: 0, w: 500, h: 500, z: 1 });
    const over = text({ id: "el_2", x: 0, y: 0, w: 500, h: 500, z: 2 });
    expect(hitTest([under, over], 50, 50)?.id).toBe("el_2");
  });

  it("returns null on empty canvas space", () => {
    expect(hitTest([box], 900, 900)).toBeNull();
  });
});

describe("geometry for chrome", () => {
  it("gives four corners, and they enclose the element when unrotated", () => {
    const el = text({ x: 10, y: 20, w: 100, h: 50 });
    expect(cornersOf(el).map((p) => [p.x, p.y])).toEqual([
      [10, 20],
      [110, 20],
      [110, 70],
      [10, 70]
    ]);
  });

  it("a rotated element's bounds are wider than the element", () => {
    const el = text({ x: 100, y: 100, w: 200, h: 100, rot: 45 });
    const b = boundsOf(el);
    expect(b.w).toBeGreaterThan(200);
    expect(b.h).toBeGreaterThan(100);
    // and still centred on the same point
    expect(b.x + b.w / 2).toBeCloseTo(200, 6);
    expect(b.y + b.h / 2).toBeCloseTo(150, 6);
  });
});
