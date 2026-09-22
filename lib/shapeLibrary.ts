/**
 * Every shape the canvas can draw, as geometry rather than as markup.
 *
 * WHY A REGISTRY. components/slide/ElementLayer.tsx rendered one hand-written SVG element
 * per kind, which is fine for three and unmaintainable for thirty-four — and that file sits
 * inside the export boundary, where it is pinned className-free and every `<svg>` must carry
 * `xmlns` or the export silently draws nothing. Keeping the geometry here leaves the
 * renderer with a single `<path>` branch: one place to get the export rules right.
 *
 * EVERY SHAPE IS A FUNCTION OF ITS BOX. `path(w, h)` fills the element's `w × h` rectangle,
 * so resizing, rotating and snapping keep working untouched — lib/slideElements.ts already
 * does all of that on `w`/`h` in base pixels and knows nothing about what is drawn inside.
 *
 * KIND vs ENTRY. `ShapeKind` is what a slide stores; `SHAPE_LIBRARY` is what the picker
 * shows. They are not one-to-one: "Rectangle" and "Rounded rectangle" are both `rect`, and
 * "Ellipse" and "Circle" are both `ellipse` — they differ only in the defaults they insert
 * with. Adding a picker entry for a kind that already exists costs nothing.
 *
 * ONE THING THAT MUST STAY IN STEP: lib/deckStore.ts validates a stored element's kind
 * against this module. It used to hold its own hardcoded list, and a kind missing from it is
 * not an error — the element is dropped, so a shape draws, saves, and then disappears on
 * reload. That is why the whitelist is derived rather than written twice.
 */

export type ShapeKind =
  // The three that existed before the library, unchanged so saved decks keep rendering.
  | "rect"
  | "ellipse"
  | "line"
  // Basics
  | "triangle"
  | "rightTriangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star"
  | "star6"
  // Arrows
  | "arrowRight"
  | "arrowLeft"
  | "arrowUp"
  | "arrowDown"
  | "arrowDouble"
  | "chevron"
  | "arrowBent"
  | "arrowCurved"
  // Callouts
  | "balloonRound"
  | "balloonSquare"
  | "thoughtBubble"
  | "captionBox"
  | "quoteBlock"
  // Banners and badges
  | "ribbon"
  | "bookmark"
  | "shield"
  | "burst"
  | "seal"
  | "tag"
  // Misc
  | "plus"
  | "heart"
  | "cloud"
  | "cylinder"
  | "parallelogram";

export type ShapeCategory = "basics" | "arrows" | "callouts" | "banners" | "misc";

export interface ShapeSpec {
  /** Picker entry id. Usually the kind, but not always — see KIND vs ENTRY above. */
  id: string;
  label: string;
  kind: ShapeKind;
  category: ShapeCategory;
  /** Extra words this entry should be findable by. The label is always searched. */
  keywords: string[];
  /** Size to insert at, in base pixels. */
  size: { w: number; h: number };
  /** Anything else the inserted element should carry, e.g. a corner radius. */
  defaults?: { radius?: number };
}

/* ------------------------------------------------------------------------------------ *
 * Geometry helpers
 * ------------------------------------------------------------------------------------ */

/** Two decimals is plenty at 1080px and keeps float noise out of the exported markup. */
const n = (v: number): string => String(Math.round(v * 100) / 100);

const poly = (pts: readonly (readonly [number, number])[]): string =>
  `M${pts.map(([x, y]) => `${n(x)},${n(y)}`).join("L")}Z`;

/**
 * A regular polygon inscribed in the box, first vertex at the top.
 *
 * Inscribed in the BOX, not in a circle, so a wide box gives a wide polygon rather than a
 * small round one floating in the middle — which is what someone dragging a corner expects.
 */
function regular(w: number, h: number, sides: number, startDeg = -90): string {
  const cx = w / 2;
  const cy = h / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = ((startDeg + (360 / sides) * i) * Math.PI) / 180;
    pts.push([cx + cx * Math.cos(a), cy + cy * Math.sin(a)]);
  }
  return poly(pts);
}

/** A star with `points` tips, alternating between the box edge and `inner` of it. */
function star(w: number, h: number, points: number, inner: number, startDeg = -90): string {
  const cx = w / 2;
  const cy = h / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 1 : inner;
    const a = ((startDeg + (180 / points) * i) * Math.PI) / 180;
    pts.push([cx + cx * r * Math.cos(a), cy + cy * r * Math.sin(a)]);
  }
  return poly(pts);
}

/** An ellipse as two arcs, so it can share the single `<path>` branch with everything else. */
function ellipsePath(w: number, h: number): string {
  const rx = w / 2;
  const ry = h / 2;
  return `M0,${n(ry)}A${n(rx)},${n(ry)} 0 1,0 ${n(w)},${n(ry)}A${n(rx)},${n(ry)} 0 1,0 0,${n(ry)}Z`;
}

/** A rounded rectangle. `r` is clamped so a small box cannot invert its own corners. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M${n(x + k)},${n(y)}H${n(x + w - k)}A${n(k)},${n(k)} 0 0,1 ${n(x + w)},${n(y + k)}` +
    `V${n(y + h - k)}A${n(k)},${n(k)} 0 0,1 ${n(x + w - k)},${n(y + h)}` +
    `H${n(x + k)}A${n(k)},${n(k)} 0 0,1 ${n(x)},${n(y + h - k)}` +
    `V${n(y + k)}A${n(k)},${n(k)} 0 0,1 ${n(x + k)},${n(y)}Z`
  );
}

/* ------------------------------------------------------------------------------------ *
 * The geometry, one entry per stored kind
 * ------------------------------------------------------------------------------------ */

export const SHAPE_GEOMETRY: Record<ShapeKind, (w: number, h: number) => string> = {
  rect: (w, h) => poly([[0, 0], [w, 0], [w, h], [0, h]]),
  ellipse: ellipsePath,
  // Stroke-only: the renderer draws this with the element's stroke and no fill.
  line: (w, h) => `M0,${n(h / 2)}L${n(w)},${n(h / 2)}`,

  triangle: (w, h) => poly([[w / 2, 0], [w, h], [0, h]]),
  rightTriangle: (w, h) => poly([[0, 0], [0, h], [w, h]]),
  diamond: (w, h) => poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]),
  pentagon: (w, h) => regular(w, h, 5),
  hexagon: (w, h) => poly([[w * 0.25, 0], [w * 0.75, 0], [w, h / 2], [w * 0.75, h], [w * 0.25, h], [0, h / 2]]),
  star: (w, h) => star(w, h, 5, 0.42),
  star6: (w, h) => star(w, h, 6, 0.55),

  arrowRight: (w, h) =>
    poly([[0, h * 0.3], [w * 0.6, h * 0.3], [w * 0.6, 0], [w, h / 2], [w * 0.6, h], [w * 0.6, h * 0.7], [0, h * 0.7]]),
  arrowLeft: (w, h) =>
    poly([[w, h * 0.3], [w * 0.4, h * 0.3], [w * 0.4, 0], [0, h / 2], [w * 0.4, h], [w * 0.4, h * 0.7], [w, h * 0.7]]),
  arrowUp: (w, h) =>
    poly([[w * 0.3, h], [w * 0.3, h * 0.4], [0, h * 0.4], [w / 2, 0], [w, h * 0.4], [w * 0.7, h * 0.4], [w * 0.7, h]]),
  arrowDown: (w, h) =>
    poly([[w * 0.3, 0], [w * 0.3, h * 0.6], [0, h * 0.6], [w / 2, h], [w, h * 0.6], [w * 0.7, h * 0.6], [w * 0.7, 0]]),
  arrowDouble: (w, h) =>
    poly([
      [0, h / 2], [w * 0.25, 0], [w * 0.25, h * 0.3], [w * 0.75, h * 0.3], [w * 0.75, 0],
      [w, h / 2], [w * 0.75, h], [w * 0.75, h * 0.7], [w * 0.25, h * 0.7], [w * 0.25, h]
    ]),
  chevron: (w, h) => poly([[0, 0], [w * 0.6, 0], [w, h / 2], [w * 0.6, h], [0, h], [w * 0.4, h / 2]]),
  arrowBent: (w, h) =>
    poly([
      [0, h * 0.55], [w * 0.55, h * 0.55], [w * 0.55, h * 0.25], [w, h * 0.5],
      [w * 0.55, h * 0.75], [w * 0.55, h * 0.85], [0, h * 0.85]
    ]),
  arrowCurved: (w, h) =>
    // A swept body, then the head. One subpath so it fills as a single shape.
    `M0,${n(h)}Q0,${n(h * 0.2)} ${n(w * 0.66)},${n(h * 0.2)}L${n(w * 0.66)},0L${n(w)},${n(h * 0.35)}` +
    `L${n(w * 0.66)},${n(h * 0.7)}L${n(w * 0.66)},${n(h * 0.5)}Q${n(w * 0.22)},${n(h * 0.5)} ${n(w * 0.22)},${n(h)}Z`,

  balloonRound: (w, h) => {
    const body = h * 0.78;
    return `${roundedRect(0, 0, w, body, Math.min(w, body) * 0.22)}M${n(w * 0.22)},${n(body)}L${n(w * 0.3)},${n(h)}L${n(w * 0.42)},${n(body)}Z`;
  },
  balloonSquare: (w, h) => {
    const body = h * 0.78;
    return `${poly([[0, 0], [w, 0], [w, body], [0, body]])}M${n(w * 0.22)},${n(body)}L${n(w * 0.3)},${n(h)}L${n(w * 0.42)},${n(body)}Z`;
  },
  thoughtBubble: (w, h) => {
    const body = h * 0.72;
    const r1 = Math.min(w, h) * 0.08;
    const r2 = r1 * 0.62;
    return (
      ellipsePath(w, body) +
      `M${n(w * 0.26 + r1)},${n(h * 0.84)}a${n(r1)},${n(r1)} 0 1,0 ${n(-r1 * 2)},0a${n(r1)},${n(r1)} 0 1,0 ${n(r1 * 2)},0Z` +
      `M${n(w * 0.14 + r2)},${n(h * 0.96)}a${n(r2)},${n(r2)} 0 1,0 ${n(-r2 * 2)},0a${n(r2)},${n(r2)} 0 1,0 ${n(r2 * 2)},0Z`
    );
  },
  captionBox: (w, h) => {
    const body = h * 0.8;
    // One polygon, tail included — the body and the tail are the same outline.
    return poly([[0, 0], [w, 0], [w, body], [w * 0.62, body], [w * 0.52, h], [w * 0.44, body], [0, body]]);
  },
  quoteBlock: (w, h) =>
    // A left rule and the panel beside it, as one fillable shape.
    `${poly([[0, 0], [w * 0.12, 0], [w * 0.12, h], [0, h]])}${poly([[w * 0.24, 0], [w, 0], [w, h], [w * 0.24, h]])}`,

  ribbon: (w, h) =>
    poly([[0, 0], [w, 0], [w * 0.86, h / 2], [w, h], [0, h], [w * 0.14, h / 2]]),
  bookmark: (w, h) => poly([[0, 0], [w, 0], [w, h], [w / 2, h * 0.74], [0, h]]),
  shield: (w, h) =>
    `M0,0H${n(w)}V${n(h * 0.52)}Q${n(w)},${n(h * 0.86)} ${n(w / 2)},${n(h)}Q0,${n(h * 0.86)} 0,${n(h * 0.52)}Z`,
  burst: (w, h) => star(w, h, 8, 0.58),
  seal: (w, h) => star(w, h, 12, 0.84),
  // No punch-hole: SVG's default nonzero fill-rule would fill a same-direction subpath
  // rather than cut it out, so a "hole" drawn that way is invisible and only costs bytes.
  tag: (w, h) => `M${n(w * 0.22)},0H${n(w)}V${n(h)}H${n(w * 0.22)}L0,${n(h / 2)}Z`,

  plus: (w, h) =>
    poly([
      [w * 0.34, 0], [w * 0.66, 0], [w * 0.66, h * 0.34], [w, h * 0.34], [w, h * 0.66],
      [w * 0.66, h * 0.66], [w * 0.66, h], [w * 0.34, h], [w * 0.34, h * 0.66], [0, h * 0.66],
      [0, h * 0.34], [w * 0.34, h * 0.34]
    ]),
  heart: (w, h) =>
    `M${n(w / 2)},${n(h)}C${n(-w * 0.16)},${n(h * 0.62)} ${n(w * 0.08)},${n(-h * 0.08)} ${n(w / 2)},${n(h * 0.26)}` +
    `C${n(w * 0.92)},${n(-h * 0.08)} ${n(w * 1.16)},${n(h * 0.62)} ${n(w / 2)},${n(h)}Z`,
  cloud: (w, h) =>
    `M${n(w * 0.22)},${n(h)}Q0,${n(h)} 0,${n(h * 0.72)}Q0,${n(h * 0.46)} ${n(w * 0.22)},${n(h * 0.44)}` +
    `Q${n(w * 0.26)},${n(h * 0.1)} ${n(w * 0.56)},${n(h * 0.14)}Q${n(w * 0.78)},${n(h * 0.06)} ${n(w * 0.84)},${n(h * 0.4)}` +
    `Q${n(w)},${n(h * 0.46)} ${n(w)},${n(h * 0.72)}Q${n(w)},${n(h)} ${n(w * 0.78)},${n(h)}Z`,
  cylinder: (w, h) => {
    const ry = h * 0.14;
    return (
      `M0,${n(ry)}A${n(w / 2)},${n(ry)} 0 1,1 ${n(w)},${n(ry)}V${n(h - ry)}` +
      `A${n(w / 2)},${n(ry)} 0 1,1 0,${n(h - ry)}Z`
    );
  },
  parallelogram: (w, h) => poly([[w * 0.24, 0], [w, 0], [w * 0.76, h], [0, h]])
};

/** Drawn with the element's stroke and no fill. */
export const STROKE_ONLY: ReadonlySet<ShapeKind> = new Set<ShapeKind>(["line"]);

/* ------------------------------------------------------------------------------------ *
 * The picker's entries
 * ------------------------------------------------------------------------------------ */

const SQUARE = { w: 300, h: 300 };
const WIDE = { w: 420, h: 240 };

export const SHAPE_LIBRARY: ShapeSpec[] = [
  // Basics
  { id: "rect", label: "Rectangle", kind: "rect", category: "basics", keywords: ["box", "square", "block"], size: WIDE },
  { id: "rounded", label: "Rounded rectangle", kind: "rect", category: "basics", keywords: ["box", "radius", "pill"], size: WIDE, defaults: { radius: 36 } },
  { id: "ellipse", label: "Ellipse", kind: "ellipse", category: "basics", keywords: ["oval", "round"], size: WIDE },
  { id: "circle", label: "Circle", kind: "ellipse", category: "basics", keywords: ["round", "dot"], size: SQUARE },
  { id: "line", label: "Line", kind: "line", category: "basics", keywords: ["rule", "divider", "stroke"], size: { w: 420, h: 6 } },
  { id: "triangle", label: "Triangle", kind: "triangle", category: "basics", keywords: ["delta", "play"], size: SQUARE },
  { id: "rightTriangle", label: "Right triangle", kind: "rightTriangle", category: "basics", keywords: ["corner", "wedge"], size: SQUARE },
  { id: "diamond", label: "Diamond", kind: "diamond", category: "basics", keywords: ["rhombus", "decision"], size: SQUARE },
  { id: "pentagon", label: "Pentagon", kind: "pentagon", category: "basics", keywords: ["five", "polygon"], size: SQUARE },
  { id: "hexagon", label: "Hexagon", kind: "hexagon", category: "basics", keywords: ["six", "polygon", "cell"], size: SQUARE },
  { id: "star", label: "Star", kind: "star", category: "basics", keywords: ["five", "rating", "favourite"], size: SQUARE },
  { id: "star6", label: "Six-point star", kind: "star6", category: "basics", keywords: ["sparkle", "burst"], size: SQUARE },

  // Arrows
  { id: "arrowRight", label: "Arrow right", kind: "arrowRight", category: "arrows", keywords: ["next", "forward", "east"], size: WIDE },
  { id: "arrowLeft", label: "Arrow left", kind: "arrowLeft", category: "arrows", keywords: ["back", "previous", "west"], size: WIDE },
  { id: "arrowUp", label: "Arrow up", kind: "arrowUp", category: "arrows", keywords: ["rise", "increase", "north"], size: { w: 240, h: 420 } },
  { id: "arrowDown", label: "Arrow down", kind: "arrowDown", category: "arrows", keywords: ["fall", "decrease", "south"], size: { w: 240, h: 420 } },
  { id: "arrowDouble", label: "Double arrow", kind: "arrowDouble", category: "arrows", keywords: ["both", "exchange", "swap"], size: WIDE },
  { id: "chevron", label: "Chevron", kind: "chevron", category: "arrows", keywords: ["step", "process", "banner"], size: WIDE },
  { id: "arrowBent", label: "Bent arrow", kind: "arrowBent", category: "arrows", keywords: ["turn", "elbow"], size: WIDE },
  { id: "arrowCurved", label: "Curved arrow", kind: "arrowCurved", category: "arrows", keywords: ["loop", "return", "sweep"], size: WIDE },

  // Callouts
  { id: "balloonRound", label: "Speech balloon", kind: "balloonRound", category: "callouts", keywords: ["bubble", "say", "comment", "quote"], size: WIDE },
  { id: "balloonSquare", label: "Square balloon", kind: "balloonSquare", category: "callouts", keywords: ["bubble", "say", "comment"], size: WIDE },
  { id: "thoughtBubble", label: "Thought bubble", kind: "thoughtBubble", category: "callouts", keywords: ["think", "cloud", "bubble"], size: WIDE },
  { id: "captionBox", label: "Caption box", kind: "captionBox", category: "callouts", keywords: ["label", "tooltip", "pointer"], size: WIDE },
  { id: "quoteBlock", label: "Quote block", kind: "quoteBlock", category: "callouts", keywords: ["pull", "cite", "rule"], size: WIDE },

  // Banners and badges
  { id: "ribbon", label: "Ribbon", kind: "ribbon", category: "banners", keywords: ["banner", "award", "header"], size: WIDE },
  { id: "bookmark", label: "Bookmark", kind: "bookmark", category: "banners", keywords: ["flag", "save", "marker"], size: { w: 240, h: 360 } },
  { id: "shield", label: "Shield", kind: "shield", category: "banners", keywords: ["badge", "secure", "trust"], size: SQUARE },
  { id: "burst", label: "Burst", kind: "burst", category: "banners", keywords: ["sale", "explosion", "sticker"], size: SQUARE },
  { id: "seal", label: "Seal", kind: "seal", category: "banners", keywords: ["stamp", "certified", "badge"], size: SQUARE },
  { id: "tag", label: "Tag", kind: "tag", category: "banners", keywords: ["label", "price", "ticket"], size: WIDE },

  // Misc
  { id: "plus", label: "Plus", kind: "plus", category: "misc", keywords: ["cross", "add", "medical"], size: SQUARE },
  { id: "heart", label: "Heart", kind: "heart", category: "misc", keywords: ["love", "like", "favourite"], size: SQUARE },
  { id: "cloud", label: "Cloud", kind: "cloud", category: "misc", keywords: ["weather", "saas", "hosting"], size: WIDE },
  { id: "cylinder", label: "Cylinder", kind: "cylinder", category: "misc", keywords: ["database", "store", "can"], size: { w: 260, h: 340 } },
  { id: "parallelogram", label: "Parallelogram", kind: "parallelogram", category: "misc", keywords: ["skew", "data", "slant"], size: WIDE }
];

/** Headings, in the order the picker shows them. */
export const SHAPE_CATEGORIES: { id: ShapeCategory; label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "arrows", label: "Arrows" },
  { id: "callouts", label: "Callouts" },
  { id: "banners", label: "Banners & badges" },
  { id: "misc", label: "Misc" }
];

export function shapeEntry(id: string): ShapeSpec | undefined {
  return SHAPE_LIBRARY.find((s) => s.id === id);
}

/** Every kind a stored element may legitimately carry. lib/deckStore.ts validates against this. */
export const SHAPE_KINDS: ShapeKind[] = Object.keys(SHAPE_GEOMETRY) as ShapeKind[];

export function isShapeKind(value: unknown): value is ShapeKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SHAPE_GEOMETRY, value);
}

/** The path for a stored element. Falls back to a plain rectangle rather than drawing nothing. */
export function pathFor(kind: ShapeKind, w: number, h: number): string {
  return (SHAPE_GEOMETRY[kind] ?? SHAPE_GEOMETRY.rect)(w, h);
}

/**
 * Entries matching a query, label first then keywords. An empty query returns everything,
 * which is what the picker shows before anybody types.
 */
export function searchShapes(query: string): ShapeSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return SHAPE_LIBRARY;
  return SHAPE_LIBRARY.filter(
    (s) => s.label.toLowerCase().includes(q) || s.keywords.some((k) => k.toLowerCase().includes(q))
  );
}
