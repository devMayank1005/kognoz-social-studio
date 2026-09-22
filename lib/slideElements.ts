// The element model for direct manipulation on the slide canvas.
//
// Pure and I/O-free, like lib/calendarPlan.ts and lib/activityEvents.ts: no DOM, no clock,
// no randomness. Every function here is geometry, so it can be tested without a browser —
// which matters more than usual, because nothing in this repo's test suite can actually
// rasterise a slide (vitest runs in `node`), and drag maths that is wrong by a factor of
// `previewScale` looks plausible right up until somebody exports a PNG.
//
// Three rules the rest of the feature depends on:
//
//   base pixels     Every coordinate here is in SLIDE space — 0..baseW, 0..baseH, the same
//                   1080x1350 the renderer lays out in and the exporter rasterises at.
//                   Screen pixels never enter this module. The caller divides pointer
//                   deltas by `previewScale` before calling in.
//   ids are stable  An element's id is derived from the ids already present, never from a
//                   clock, so the same sequence of edits always produces the same document
//                   and a test can assert on it.
//   `from` means    An element carrying `from` started life as part of the template and was
//   ejected         ejected into a free object. That single field is what tells the renderer
//                   to hide the original, and what a regenerate throws away.

import { C } from "./tokens";
import { STROKE_ONLY, type ShapeKind } from "./shapeLibrary";
import type { Gradient } from "./gradient";
import { familiesInHtml, hasItalicInHtml, weightsInHtml } from "./richText";

/** The template text slots an element can be ejected from. */
export type TemplateSlot = "eyebrow" | "headline" | "body" | "cta" | "kicker" | "number";

export interface BaseElement {
  id: string;
  /** Top-left corner in base pixels, before rotation. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, normalised to (-180, 180]. Rotation is about the element's centre. */
  rot: number;
  z: number;
}

export interface TextElement extends BaseElement {
  kind: "text";
  text: string;
  fontFamily: string;
  /**
   * Absolute base pixels — NOT the renderer's `fit()` result.
   *
   * `fit()` (components/Slide.tsx) derives a size from character count and then multiplies
   * by the per-slide text scale. Once an element is ejected it carries the size it had at
   * that moment and stops responding to either, which is the behaviour a canvas editor
   * needs and the reason we do not have to touch ~200 `fit()` call sites.
   */
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  /**
   * The rest of the typography, applied to the WHOLE box.
   *
   * All optional, so every deck written before them loads unchanged. They exist because the
   * toolbar's rule is "selection if there is one, element otherwise" — without a field here,
   * applying letter-spacing with nothing selected would patch a property the renderer never
   * reads and lib/deckStore.ts drops on the next load: a silent no-op that also pollutes
   * stored decks.
   *
   * `verticalAlign` and the gradient properties are deliberately NOT here. A superscript or
   * a clipped gradient applied to an entire text box is not a meaningful operation; those
   * stay per-range.
   */
  fontStyle?: "normal" | "italic";
  backgroundColor?: string;
  /** Space-separated: "underline", "line-through", "overline", or "none". */
  textDecorationLine?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  /** Base pixels. Negative is legitimate for tight display type. */
  letterSpacing?: number;
  opacity?: number;
  textShadow?: string;
  /** `-webkit-text-stroke`, e.g. "2px #000". */
  webkitTextStroke?: string;
  direction?: "ltr" | "rtl";
  from?: TemplateSlot;
  /**
   * Which INSTANCE of that slot this came from, when a slide has more than one.
   *
   * `from` is the slot's kind — headline, body, number — and that was enough while only
   * the cover, the content slide and the CTA were unlockable, because each had one of
   * each. It is not enough for the single formats: a Journey Map has three stage titles,
   * a Numbers Wall four figures, a Dialogue a turn per line. They are all `headline`, and
   * components/studio/SlideCanvas.tsx hides by slot name — so ejecting one stage title
   * would blank all three.
   *
   * So the identity of a slot is `slotKey ?? from`. Absent means "the only one", which is
   * exactly what every deck saved before this says, and they keep working untouched.
   */
  slotKey?: string;
  /**
   * The element's rendered markup, when it came from the template.
   *
   * The template does not draw plain strings: a starred word becomes a `<span>` carrying a
   * clipped gradient, and a multi-line body becomes one `display:block` span per line. Both
   * are lost by reading `textContent` — the gradient turns flat, and two lines concatenate
   * into one with no space between them. Carrying the markup keeps an unlocked element
   * pixel-identical to the template it replaced.
   *
   * Absent on text boxes somebody added by hand; those are plain strings and stay that way.
   */
  html?: string;
}

// Declared by lib/shapeLibrary.ts, which owns both the list and the geometry. Re-exported
// here because this module is what the rest of the app imports element types from, and two
// declarations of the same union is how a shape ends up drawable but not storable.
export type { ShapeKind };

export interface ShapeElement extends BaseElement {
  kind: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Corner radius, `rect` only. Ignored by the other kinds. */
  radius: number;
  opacity: number;
  /**
   * A gradient fill, which takes precedence over `fill` when it is drawable.
   *
   * STRUCTURED, NOT A CSS STRING, and not for tidiness. SVG `fill` is a presentation
   * attribute: it takes a paint, and `linear-gradient(…)` is not one — the shape would
   * simply not draw. It needs `<defs><linearGradient>` plus `fill="url(#id)"`, which is a
   * structure at the point of rendering anyway.
   *
   * The storage layer is the other half of the reason. lib/deckStore.ts truncates colour
   * strings at 64 characters silently, and a four-stop gradient is 75 — it would be cut into
   * CSS that is invalid but still looks plausible, and only on the NEXT load. An object with
   * clamped numbers and a capped stop count cannot fail that way.
   *
   * `fill` is left in place as the fallback, so no saved deck changes meaning.
   */
  fillGradient?: Gradient;
}

export type SlideElement = TextElement | ShapeElement;

/**
 * The eight resize grips, named for the compass point they sit on.
 * The corners resize two axes; the edges resize one.
 */
export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/** Shared empty array, frozen, so a slide with no elements never makes a new object. */
export const NO_ELEMENTS: readonly SlideElement[] = Object.freeze([]);

/** Nothing may be resized smaller than this, or it becomes impossible to grab again. */
export const MIN_SIZE = 8;

/** How much of an element must stay on the canvas, so it can never be dragged out of reach. */
const KEEP_VISIBLE = 24;

const rad = (deg: number) => (deg * Math.PI) / 180;
const round = (n: number) => Math.round(n * 100) / 100;

/** Rotate a vector about the origin. */
function rotateVec(x: number, y: number, deg: number): { x: number; y: number } {
  const r = rad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** Takes a bare box, not a whole element, so callers can ask about a drag draft too. */
export function centerOf(el: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: el.x + el.w / 2, y: el.y + el.h / 2 };
}

/** Normalise to (-180, 180] so two rotations that look identical compare equal. */
export function normaliseRotation(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  // -0 and 0 are the same angle but not the same value; callers compare rot === 0.
  return round(d) === 0 ? 0 : round(d);
}

/**
 * Next free id.
 *
 * Derived from the ids already in the slide rather than from a counter or a clock, so the
 * function stays pure and re-running the same edits produces the same document.
 */
export function nextElementId(elements: readonly SlideElement[]): string {
  let max = 0;
  for (const el of elements) {
    const m = /^el_(\d+)$/.exec(el.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `el_${max + 1}`;
}

/** One above everything present, so a new element lands on top. */
export function nextZ(elements: readonly SlideElement[]): number {
  return elements.reduce((n, e) => Math.max(n, e.z), 0) + 1;
}

export function createText(elements: readonly SlideElement[], patch: Partial<TextElement> = {}): TextElement {
  const fontSize = patch.fontSize ?? 48;
  const lineHeight = patch.lineHeight ?? 1.2;
  return {
    id: nextElementId(elements),
    kind: "text",
    x: 120,
    y: 120,
    w: 520,
    // One line of the chosen size. The box hugs its text rather than padding it out: text
    // renders as a block, so a box taller than its content would sit the words at the top
    // of an obviously oversized selection frame.
    h: Math.round(fontSize * lineHeight),
    rot: 0,
    z: nextZ(elements),
    text: "Text",
    fontFamily: "'Open Sans', system-ui, sans-serif",
    fontSize: 48,
    fontWeight: 700,
    color: "#212121",
    align: "left",
    lineHeight: 1.2,
    ...patch
  };
}

export function createShape(
  elements: readonly SlideElement[],
  kind: ShapeKind,
  patch: Partial<ShapeElement> = {}
): ShapeElement {
  // Stroke-only shapes are inked rather than filled, and they are the reason this is not a
  // single set of defaults. A line still needs a box with height: it is what the grips
  // attach to and what the renderer sizes its <svg> from — a zero-height box renders
  // nothing and cannot be grabbed.
  const inked = STROKE_ONLY.has(kind);
  return {
    id: nextElementId(elements),
    kind,
    x: 120,
    y: 120,
    w: inked ? 360 : 280,
    h: inked ? 4 : 280,
    rot: 0,
    z: nextZ(elements),
    fill: inked ? "transparent" : C.blue,
    stroke: inked ? "#212121" : "transparent",
    strokeWidth: inked ? 4 : 0,
    radius: 0,
    opacity: 1,
    ...patch
  };
}

/**
 * Keep an element reachable.
 *
 * The slide root is `overflow: hidden`, so anything pushed past the edge is clipped
 * identically on screen and in the export — consistent, but a fully off-canvas element
 * can never be clicked again. Leave a grabbable sliver on the canvas instead.
 */
export function clampToCanvas<T extends BaseElement>(el: T, baseW: number, baseH: number): T {
  const x = Math.min(Math.max(el.x, KEEP_VISIBLE - el.w), baseW - KEEP_VISIBLE);
  const y = Math.min(Math.max(el.y, KEEP_VISIBLE - el.h), baseH - KEEP_VISIBLE);
  return { ...el, x: round(x), y: round(y) };
}

export function moveTo<T extends BaseElement>(el: T, x: number, y: number): T {
  return { ...el, x: round(x), y: round(y) };
}

export function moveBy<T extends BaseElement>(el: T, dx: number, dy: number): T {
  return moveTo(el, el.x + dx, el.y + dy);
}

export function rotateTo<T extends BaseElement>(el: T, deg: number, snapStep = 0): T {
  const d = snapStep > 0 ? Math.round(deg / snapStep) * snapStep : deg;
  return { ...el, rot: normaliseRotation(d) };
}

export interface ResizeOptions {
  /** Corner handles only: keep the original aspect ratio. */
  lockAspect?: boolean;
  min?: number;
}

/**
 * Resize by dragging one grip, with the opposite edge or corner pinned.
 *
 * The delta arrives in world (canvas) space but the box grows along its OWN axes, so the
 * delta is rotated into the element's local frame first, applied there, and the resulting
 * centre shift rotated back out. Skipping that is the classic rotated-resize bug: the box
 * appears to drift sideways as you drag, and it only shows up once something is rotated.
 */
export function resizeBy<T extends BaseElement>(
  el: T,
  handle: Handle,
  dxWorld: number,
  dyWorld: number,
  opts: ResizeOptions = {}
): T {
  const min = opts.min ?? MIN_SIZE;
  const local = rotateVec(dxWorld, dyWorld, -el.rot);

  const east = handle.includes("e");
  const west = handle.includes("w");
  const south = handle.includes("s");
  const north = handle.includes("n");

  let w = el.w;
  let h = el.h;
  if (east) w = Math.max(min, el.w + local.x);
  if (west) w = Math.max(min, el.w - local.x);
  if (south) h = Math.max(min, el.h + local.y);
  if (north) h = Math.max(min, el.h - local.y);

  // Corner drags with aspect locked follow whichever axis moved further, so the pointer
  // stays near the grip instead of the box snapping to one axis.
  if (opts.lockAspect && (east || west) && (north || south) && el.w > 0 && el.h > 0) {
    const ratio = el.w / el.h;
    if (Math.abs(w - el.w) >= Math.abs(h - el.h)) h = Math.max(min, w / ratio);
    else w = Math.max(min, h * ratio);
  }

  // The pinned edge must not move, so the centre shifts by half of whatever the size
  // actually changed by — "actually" because a min-size clamp may have eaten the drag.
  const dw = w - el.w;
  const dh = h - el.h;
  const shiftLocal = {
    x: east ? dw / 2 : west ? -dw / 2 : 0,
    y: south ? dh / 2 : north ? -dh / 2 : 0
  };
  const shiftWorld = rotateVec(shiftLocal.x, shiftLocal.y, el.rot);
  const c = centerOf(el);
  const cx = c.x + shiftWorld.x;
  const cy = c.y + shiftWorld.y;

  return { ...el, x: round(cx - w / 2), y: round(cy - h / 2), w: round(w), h: round(h) };
}

// --- hit testing -----------------------------------------------------------

/**
 * Is this canvas point inside the element?
 *
 * The point is moved into the element's own frame before the comparison, because a rotated
 * box is not an axis-aligned rectangle and testing its bounding box instead would let you
 * select a rotated element by clicking empty space near its corners.
 *
 * `slop` widens the target. A 4px line is honest geometry and an impossible click target,
 * so thin shapes get a few pixels of forgiveness in every direction.
 */
export function containsPoint(el: BaseElement, px: number, py: number, slop = 0): boolean {
  const c = centerOf(el);
  const local = rotateVec(px - c.x, py - c.y, -el.rot);
  return Math.abs(local.x) <= el.w / 2 + slop && Math.abs(local.y) <= el.h / 2 + slop;
}

/** The element a click lands on: topmost first, so the one you can see is the one you get. */
export function hitTest(elements: readonly SlideElement[], px: number, py: number, slop = 6): SlideElement | null {
  const ordered = sortByZ(elements);
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (containsPoint(ordered[i], px, py, slop)) return ordered[i];
  }
  return null;
}

/** The four corners in canvas space, for drawing grips on a rotated element. */
export function cornersOf(el: BaseElement): { x: number; y: number }[] {
  const c = centerOf(el);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ].map(([sx, sy]) => {
    const v = rotateVec((sx * el.w) / 2, (sy * el.h) / 2, el.rot);
    return { x: c.x + v.x, y: c.y + v.y };
  });
}

/** Axis-aligned bounds of a possibly-rotated element — where to park a toolbar. */
export function boundsOf(el: BaseElement): { x: number; y: number; w: number; h: number } {
  const pts = cornersOf(el);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// --- z-order ---------------------------------------------------------------

/** Render order. A stable tiebreak on id keeps two elements sharing a z from flickering. */
export function sortByZ(elements: readonly SlideElement[]): SlideElement[] {
  return [...elements].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
}

/** Rewrite z as 1..n in current order, so the numbers never drift apart. */
function renumber(ordered: SlideElement[]): SlideElement[] {
  return ordered.map((el, i) => ({ ...el, z: i + 1 }));
}

function reorder(elements: readonly SlideElement[], id: string, to: (i: number, n: number) => number): SlideElement[] {
  const ordered = sortByZ(elements);
  const i = ordered.findIndex((e) => e.id === id);
  if (i === -1) return [...elements];
  const target = Math.min(Math.max(to(i, ordered.length), 0), ordered.length - 1);
  if (target === i) return renumber(ordered);
  const [moved] = ordered.splice(i, 1);
  ordered.splice(target, 0, moved);
  return renumber(ordered);
}

export const bringForward = (els: readonly SlideElement[], id: string) => reorder(els, id, (i) => i + 1);
export const sendBackward = (els: readonly SlideElement[], id: string) => reorder(els, id, (i) => i - 1);
export const bringToFront = (els: readonly SlideElement[], id: string) => reorder(els, id, (_i, n) => n - 1);
export const sendToBack = (els: readonly SlideElement[], id: string) => reorder(els, id, () => 0);

// --- snapping --------------------------------------------------------------

export interface SnapGuide {
  axis: "x" | "y";
  /** Base-pixel position of the line to draw. */
  at: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

/**
 * Nudge a dragged box onto the nearest edge or centre line.
 *
 * Only applied to unrotated elements: the edges of a rotated box are not axis-aligned, so
 * "align its left edge" has no single answer, and snapping one anyway makes the element
 * jump in a direction the user did not drag.
 */
export function snapPosition(
  box: { x: number; y: number; w: number; h: number; rot: number; id?: string },
  others: readonly SlideElement[],
  baseW: number,
  baseH: number,
  tolerance = 8
): SnapResult {
  if (box.rot !== 0) return { x: box.x, y: box.y, guides: [] };

  const xTargets = [0, baseW / 2, baseW];
  const yTargets = [0, baseH / 2, baseH];
  for (const o of others) {
    if (o.id === box.id || o.rot !== 0) continue;
    xTargets.push(o.x, o.x + o.w / 2, o.x + o.w);
    yTargets.push(o.y, o.y + o.h / 2, o.y + o.h);
  }

  // Each axis offers three anchors — leading edge, centre, trailing edge — and the closest
  // pairing within tolerance wins.
  const best = (edges: number[], targets: number[]) => {
    let delta = 0;
    let at: number | null = null;
    let dist = tolerance + 1;
    for (const e of edges) {
      for (const t of targets) {
        const d = Math.abs(t - e);
        if (d <= tolerance && d < dist) {
          dist = d;
          delta = t - e;
          at = t;
        }
      }
    }
    return { delta, at };
  };

  const sx = best([box.x, box.x + box.w / 2, box.x + box.w], xTargets);
  const sy = best([box.y, box.y + box.h / 2, box.y + box.h], yTargets);

  const guides: SnapGuide[] = [];
  if (sx.at !== null) guides.push({ axis: "x", at: sx.at });
  if (sy.at !== null) guides.push({ axis: "y", at: sy.at });

  return { x: round(box.x + sx.delta), y: round(box.y + sy.delta), guides };
}

// --- template ejection -----------------------------------------------------

/** Which template slots are currently ejected, and so must not be drawn by the renderer. */
export function hiddenSlots(elements: readonly SlideElement[]): Set<string> {
  const out = new Set<string>();
  for (const el of elements) if (el.kind === "text" && el.from) out.add(slotIdentity(el.from, el.slotKey));
  return out;
}

/**
 * What names one slot on one slide.
 *
 * The key when the template gave it one, the slot kind otherwise. Keeping the fallback is
 * what lets every deck written before `slotKey` existed go on hiding the right node.
 */
export function slotIdentity(from: TemplateSlot, key?: string): string {
  return key || from;
}

/** Put an ejected element back under template control. */
export function resetSlot(elements: readonly SlideElement[], identity: string): SlideElement[] {
  return elements.filter(
    (el) => !(el.kind === "text" && el.from && slotIdentity(el.from, el.slotKey) === identity)
  );
}

/**
 * What survives a regenerate.
 *
 * Shapes and text boxes somebody added are their own work and stay. An ejected element is a
 * copy of template text that the model has just replaced, so keeping it would leave the old
 * wording sitting on the slide next to the new — worse than losing the positioning.
 */
export function applyRegenerate(elements: readonly SlideElement[]): SlideElement[] {
  return renumber(sortByZ(elements.filter((el) => !(el.kind === "text" && el.from))));
}

// --- markup -----------------------------------------------------------------

/**
 * Tags an element's markup may contain.
 *
 * Only what the slide renderer itself emits. `<br>` is here because the exporter normalises
 * it (lib/exportPipeline.ts) — a void element it does NOT normalise would throw an XML parse
 * error and take the whole slide's export down with it.
 */
const ALLOWED_TAGS = new Set(["span", "br", "b", "i", "em", "strong"]);

/**
 * Reduce markup to the subset the renderer produces and the exporter can survive.
 *
 * The HTML here is our own output, so this is not defending against a hostile author. It is
 * defending the export: this value round-trips through /api/store as JSON, and a row edited
 * by hand — or by a future version of this app — must not be able to put a `<script>`, an
 * external `url(...)` (which taints the export canvas) or an unnormalised void tag inside
 * the node the rasteriser clones.
 *
 * Attributes other than `style` are dropped wholesale: nothing the renderer emits needs one.
 */
export function sanitiseHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    // Drop these with their contents, not just their tags.
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g, (full, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (full.startsWith("</")) return `</${tag}>`;
      if (tag === "br") return "<br/>";
      const m = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
      const style = m ? (m[1] ?? m[2] ?? "") : "";
      // url() would let a remote image in, and a remote image taints the export canvas.
      const safe = style && !/url\(|expression|javascript:|@import|<|>/i.test(style) ? style : "";
      return safe ? `<${tag} style="${safe}">` : `<${tag}>`;
    });
}

/**
 * The words, with the markup removed — for search, budgets and a plain-text fallback.
 *
 * BLOCK SPANS COUNT AS LINE BREAKS, and that is a fix rather than a flourish. `renderLines`
 * (components/Slide.tsx) gives every line of a body its own `display:block` span, and this
 * used to delete those tags with no separator — so a three-line body read back as
 * "Screen AIInterview Partner AICandidate profile". lib/templateSlots.ts's header has
 * always promised the opposite, that `text` is the reading "with the line breaks put back".
 * Measured across every format: 76 of 76 multi-line slots came back run together.
 *
 * `<br>` stays the other separator; an ordinary inline span is still no break at all.
 */
export function textOfHtml(html: string): string {
  return html
    .replace(/<span[^>]*display\s*:\s*block[^>]*>/gi, "\n$&")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// --- gestures ---------------------------------------------------------------

/**
 * Did this gesture actually change anything?
 *
 * A plain click arms a move gesture and ends it with zero delta. Committing that writes an
 * identical element and — because every commit snapshots the deck — leaves an undo entry
 * behind, so ten clicks cost ten presses of Cmd+Z before anything real is undone.
 */
export function sameBox(a: SlideElement, b: SlideElement): boolean {
  if (a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h || a.rot !== b.rot) return false;
  if (a.kind === "text" && b.kind === "text" && a.fontSize !== b.fontSize) return false;
  return true;
}

const isCorner = (h: Handle) => (h.includes("n") || h.includes("s")) && (h.includes("e") || h.includes("w"));

/**
 * Resize, scaling the type when the gesture says to.
 *
 * Corner handles on TEXT scale the font with the box, which is what Canva does and what
 * people expect when they grab a corner: the words get bigger, they do not re-wrap. Edge
 * handles change the box only, so the text re-flows at the size it already had. Shapes are
 * unaffected either way.
 */
export function resizeElement(el: SlideElement, handle: Handle, dx: number, dy: number, opts: ResizeOptions = {}): SlideElement {
  const scalesType = el.kind === "text" && isCorner(handle);
  const resized = resizeBy(el, handle, dx, dy, { ...opts, lockAspect: opts.lockAspect || scalesType });
  if (!scalesType || el.w <= 0) return resized;
  const factor = resized.w / el.w;
  return { ...(resized as TextElement), fontSize: Math.max(1, round((el as TextElement).fontSize * factor)) };
}

// --- collection helpers ----------------------------------------------------

export function updateElement(
  elements: readonly SlideElement[],
  id: string,
  patch: (el: SlideElement) => SlideElement
): SlideElement[] {
  return elements.map((el) => (el.id === id ? patch(el) : el));
}

export function removeElement(elements: readonly SlideElement[], id: string): SlideElement[] {
  return renumber(sortByZ(elements.filter((el) => el.id !== id)));
}

/**
 * Families in use, so the exporter embeds those faces and only those.
 *
 * Reads BOTH the element's own family and every family named inside its markup. A font
 * applied to a selection lives in a `<span style="font-family: …">` and nowhere else; an
 * exporter that only asked the element would embed nothing for it, and that word would come
 * back from the rasteriser in a system fallback while looking perfect on screen.
 */
export function fontFamiliesUsed(elements: readonly SlideElement[]): string[] {
  const out = new Set<string>();
  for (const el of elements) {
    if (el.kind !== "text") continue;
    if (el.fontFamily) out.add(el.fontFamily);
    for (const family of familiesInHtml(el.html ?? "")) out.add(family);
  }
  return [...out].sort();
}

/**
 * Every colour this deck already uses, newest-looking first is not the point — order is
 * stable so the swatch row does not reshuffle under the cursor.
 *
 * Offered in the picker as "Document", the same idea as the brand palette but taken from the
 * work rather than the brand: matching a colour you used three slides ago should not mean
 * hunting for its hex.
 *
 * READS THE MARKUP AS WELL AS THE FIELDS, and that is the whole lesson from the font bug
 * this file already carries: a colour applied to a RANGE lives only inside `el.html`, so a
 * scan of the element fields alone reports a colour nobody used and misses the ones they did.
 * `fontFamiliesUsed` above learnt this the hard way.
 */
export function colorsUsed(elements: readonly SlideElement[]): string[] {
  const out = new Set<string>();
  const add = (value: string | undefined) => {
    const c = (value ?? "").trim();
    // `transparent` is the absence of a colour, not one somebody chose.
    if (c && c !== "transparent" && c !== "none") out.add(c);
  };

  for (const el of elements) {
    if (el.kind === "text") {
      add(el.color);
      add(el.backgroundColor);
      for (const m of (el.html ?? "").matchAll(/(?:^|[;"\s])(?:background-)?color\s*:\s*([^;"]+)/gi)) {
        add(m[1]);
      }
    } else {
      add(el.fill);
      add(el.stroke);
      for (const stop of el.fillGradient?.stops ?? []) add(stop.color);
    }
  }
  return [...out].sort();
}

/** The faces a deck actually uses, per family, so an export embeds those and no others. */
export interface UsedFaces {
  weights: number[];
  italics: number[];
}

/**
 * Which faces of which families a deck really needs.
 *
 * A family's full axis can be eighteen faces; a deck using one of them should not base64
 * the other seventeen into every slide's SVG.
 *
 * DELIBERATELY OVER-INCLUSIVE WITHIN AN ELEMENT. A span can set `font-weight: 700` without
 * naming a family, inheriting whichever family is around it, so the weight cannot be tied to
 * one family with certainty. Every weight seen in an element is therefore attributed to every
 * family in that element. That embeds the occasional face nobody uses; the opposite error —
 * missing a face — means the word silently falls back to a system font in the downloaded
 * file, which is the failure this whole area exists to prevent.
 */
export function fontFacesUsed(elements: readonly SlideElement[]): Map<string, UsedFaces> {
  const out = new Map<string, UsedFaces>();
  for (const el of elements) {
    if (el.kind !== "text") continue;
    const html = el.html ?? "";
    const families = new Set<string>();
    if (el.fontFamily) families.add(el.fontFamily);
    for (const f of familiesInHtml(html)) families.add(f);
    if (!families.size) continue;

    const weights = new Set<number>();
    if (Number.isFinite(el.fontWeight)) weights.add(el.fontWeight);
    for (const w of weightsInHtml(html)) weights.add(w);
    if (!weights.size) weights.add(400);

    const italic = el.fontStyle === "italic" || hasItalicInHtml(html);

    for (const family of families) {
      const entry = out.get(family) ?? { weights: [], italics: [] };
      const w = new Set(entry.weights);
      const i = new Set(entry.italics);
      for (const value of weights) {
        w.add(value);
        if (italic) i.add(value);
      }
      out.set(family, {
        weights: [...w].sort((a, b) => a - b),
        italics: [...i].sort((a, b) => a - b)
      });
    }
  }
  return out;
}
