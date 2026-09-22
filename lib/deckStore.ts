// The working deck, saved so a refresh does not throw it away.
//
// Before this, nothing about a deck survived a reload: slides, images, per-slide text
// scale and every hand-placed canvas element lived only in React state. That was a fair
// trade while a deck was a few generated sentences you could regenerate in seconds. It
// stopped being fair the moment somebody could spend half an hour positioning things.
//
// Pure and I/O-free, like lib/calendarPlan.ts — the caller does the reading and writing.
// Validation is hand-rolled on purpose; this repo has no schema library and deliberately
// takes `unknown` and snaps it onto something the app already understands.

import type { CoercedSlide } from "./coerce";
import { sanitiseHtml, sortByZ, type ShapeKind, type SlideElement, type TemplateSlot } from "./slideElements";
import { MIN_STOPS, normaliseGradient, type Gradient, type GradientStop } from "./gradient";
import { isShapeKind } from "./shapeLibrary";

export interface StoredDeck {
  version: 1;
  format: string;
  eyebrow: string;
  cover: string;
  cta: string;
  slides: CoercedSlide[];
  images: Record<string, string>;
  scales: Record<number, number>;
  imgOn: Record<number, boolean>;
  elements: Record<number, SlideElement[]>;
  /**
   * Colours somebody saved by hand, travelling with the deck.
   *
   * In the deck rather than in localStorage because a saved palette is part of the work:
   * it should survive a different browser and be there for anyone who opens the same deck.
   * Recently-used colours are the opposite — a per-person convenience that would churn the
   * autosave on every click — so those live in localStorage (lib/recentColors.ts).
   *
   * Optional, so `version` stays 1 and every deck saved before this loads unchanged.
   */
  palette?: string[];
  updatedAt: string;
}

/** Enough for a considered set, few enough that it cannot bloat the deck blob. */
export const MAX_PALETTE = 24;

/**
 * Above this the deck is not autosaved.
 *
 * Photos are stored as base64 data URLs and the whole deck is one jsonb blob, so a couple
 * of large images turn every keystroke's autosave into a multi-megabyte upload. Refusing
 * loudly beats a save that quietly takes seconds, or a row the database rejects.
 */
export const DECK_PAYLOAD_LIMIT = 4_000_000;

const str = (v: unknown, max = 100_000): string => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

// The list of drawable kinds lives in lib/shapeLibrary.ts and is asked for, never copied.
// A kind missing from here is NOT an error — the element below is dropped — so a shape
// would draw, save, and then quietly disappear on the next load. That bug is only visible
// after a reload, which is exactly the kind that ships.
const SLOTS: TemplateSlot[] = ["eyebrow", "headline", "body", "cta", "kicker", "number"];

/**
 * One element, or null if it is past saving.
 *
 * A missing id or an impossible size cannot be fixed by guessing; anything cosmetic falls
 * back instead, so one bad colour never costs somebody the rest of the slide.
 */
/**
 * Keep one optional field, and only when the coercion makes sense of it.
 *
 * Returns an empty object otherwise, so it spreads to nothing and the property stays absent
 * rather than becoming `undefined` — a deck should not grow a key for every style nobody set.
 */
function pick<K extends string>(
  o: Record<string, unknown>,
  key: K,
  coerce: (value: unknown) => unknown
): Record<string, unknown> {
  if (o[key] === undefined || o[key] === null) return {};
  const value = coerce(o[key]);
  return value === undefined ? {} : { [key]: value };
}

export function coerceElement(raw: unknown): SlideElement | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id, 64);
  if (!id) return null;

  const base = {
    id,
    x: num(o.x),
    y: num(o.y),
    w: Math.max(0, num(o.w)),
    h: Math.max(0, num(o.h)),
    rot: num(o.rot),
    z: num(o.z, 1)
  };
  if (base.w <= 0 && base.h <= 0) return null;

  if (o.kind === "text") {
    const from = SLOTS.includes(o.from as TemplateSlot) ? (o.from as TemplateSlot) : undefined;
    const align = o.align === "center" || o.align === "right" ? o.align : "left";
    return {
      ...base,
      kind: "text",
      text: str(o.text),
      fontFamily: str(o.fontFamily, 200) || "sans-serif",
      fontSize: Math.max(1, num(o.fontSize, 32)),
      fontWeight: num(o.fontWeight, 400),
      color: str(o.color, 64) || "#000000",
      align,
      lineHeight: num(o.lineHeight, 1.2) || 1.2,
      // The optional typography, each kept only when the row actually carries it.
      //
      // THIS IS THE GUARD. A field missing from here is not an error — it is dropped, so the
      // property applies on screen, saves, and is gone on the next load with nothing saying
      // why. Every field added to TextElement has to be added here in the same commit, which
      // is what the round-trip test in this file's suite exists to force.
      ...pick(o, "fontStyle", (v) => (v === "italic" || v === "normal" ? v : undefined)),
      ...pick(o, "backgroundColor", (v) => str(v, 64) || undefined),
      ...pick(o, "textDecorationLine", (v) => str(v, 64) || undefined),
      ...pick(o, "textTransform", (v) =>
        v === "uppercase" || v === "lowercase" || v === "capitalize" || v === "none" ? v : undefined
      ),
      ...pick(o, "letterSpacing", (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined)),
      ...pick(o, "opacity", (v) =>
        Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : undefined
      ),
      ...pick(o, "textShadow", (v) => str(v, 200) || undefined),
      ...pick(o, "webkitTextStroke", (v) => str(v, 64) || undefined),
      ...pick(o, "direction", (v) => (v === "rtl" || v === "ltr" ? v : undefined)),
      ...(from ? { from } : {}),
      // Same guard as every other optional field: uncoerced means dropped on reload, and a
      // dropped slotKey un-hides the template text under an ejected element.
      ...(from ? pick(o, "slotKey", (v) => str(v, 64) || undefined) : {}),
      // Re-sanitised on the way in, not just on the way out: this row is JSON in a database
      // and the markup ends up inside the node the exporter rasterises.
      ...(typeof o.html === "string" && o.html ? { html: sanitiseHtml(o.html) } : {})
    };
  }

  if (!isShapeKind(o.kind)) return null;
  return {
    ...base,
    kind: o.kind as ShapeKind,
    fill: str(o.fill, 64) || "transparent",
    stroke: str(o.stroke, 64) || "transparent",
    strokeWidth: Math.max(0, num(o.strokeWidth)),
    radius: Math.max(0, num(o.radius)),
    opacity: Math.min(1, Math.max(0, num(o.opacity, 1))),
    // Same guard as the text block above, for the same reason. A gradient that is not
    // coerced here draws, saves, and is gone on the next load with nothing saying why.
    ...pick(o, "fillGradient", coerceGradient)
  };
}

/**
 * A stored gradient, or nothing.
 *
 * Every number is clamped and the stop count is capped, so a hand-edited row cannot put a
 * thousand stops on one shape and push the deck past DECK_PAYLOAD_LIMIT. Anything that does
 * not survive as at least two usable stops is dropped WHOLE rather than stored half-valid:
 * a one-stop gradient is not a gradient, and a shape that fell back to its solid `fill` is a
 * better outcome than one that renders as nothing.
 */
function coerceGradient(raw: unknown): Gradient | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const g = raw as Record<string, unknown>;
  if (!Array.isArray(g.stops)) return undefined;

  const stops: GradientStop[] = [];
  for (const entry of g.stops) {
    if (!entry || typeof entry !== "object") continue;
    const stop = entry as Record<string, unknown>;
    const color = str(stop.color, 64);
    if (!color) continue;
    stops.push({ color, at: num(stop.at) });
  }
  if (stops.length < MIN_STOPS) return undefined;

  const out = normaliseGradient({
    type: g.type === "radial" ? "radial" : "linear",
    angle: num(g.angle),
    stops
  });
  return out.stops.length >= MIN_STOPS ? out : undefined;
}

/** The per-slide element map, dropping anything unreadable rather than failing the load. */
export function coerceElementMap(raw: unknown): Record<number, SlideElement[]> {
  const out: Record<number, SlideElement[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || !Array.isArray(value)) continue;
    const kept = value.map(coerceElement).filter((e): e is SlideElement => e !== null);
    if (kept.length) out[idx] = sortByZ(kept);
  }
  return out;
}

function numberMap<T>(raw: unknown, pick: (v: unknown) => T | null): Record<number, T> {
  const out: Record<number, T> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Number(key);
    const v = pick(value);
    if (Number.isInteger(idx) && idx >= 0 && v !== null) out[idx] = v;
  }
  return out;
}

/** A stored deck, or null when there is nothing usable — an empty seed row, say. */
export function coerceStoredDeck(raw: unknown): StoredDeck | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.slides)) return null;

  const slides: CoercedSlide[] = o.slides
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({ title: str(s.title, 400), body: str(s.body, 4000) }))
    .filter((s) => s.title || s.body);
  if (!slides.length) return null;

  const images: Record<string, string> = {};
  if (o.images && typeof o.images === "object") {
    for (const [k, v] of Object.entries(o.images as Record<string, unknown>)) {
      // Only inlined images. A remote URL taints the export canvas, and the app converts
      // every picture to a data URL at the input boundary for exactly that reason.
      if (typeof v === "string" && v.startsWith("data:")) images[k] = v;
    }
  }

  return {
    version: 1,
    format: str(o.format, 64),
    eyebrow: str(o.eyebrow, 200),
    cover: str(o.cover, 1000),
    cta: str(o.cta, 1000),
    slides,
    images,
    scales: numberMap(o.scales, (v) => (typeof v === "number" && Number.isFinite(v) ? Math.min(3, Math.max(0.2, v)) : null)),
    imgOn: numberMap(o.imgOn, (v) => (typeof v === "boolean" ? v : null)),
    elements: coerceElementMap(o.elements),
    ...pick(o, "palette", (v) =>
      Array.isArray(v)
        ? (() => {
            const kept = v.map((c) => str(c, 64)).filter(Boolean).slice(0, MAX_PALETTE);
            return kept.length ? kept : undefined;
          })()
        : undefined
    ),
    updatedAt: str(o.updatedAt, 40)
  };
}

export interface SerialisedDeck {
  json: string;
  bytes: number;
  tooLarge: boolean;
}

/** Serialise once, so the caller can check the size without doing the work twice. */
export function serialiseDeck(deck: StoredDeck): SerialisedDeck {
  const json = JSON.stringify(deck);
  // Byte length, not character count: a base64 image is ASCII but the rest may not be.
  const bytes = typeof TextEncoder === "undefined" ? json.length : new TextEncoder().encode(json).length;
  return { json, bytes, tooLarge: bytes > DECK_PAYLOAD_LIMIT };
}

/** True when the deck differs in any way worth writing. */
export function deckChanged(a: StoredDeck | null, b: StoredDeck): boolean {
  if (!a) return true;
  const strip = ({ updatedAt, ...rest }: StoredDeck) => rest;
  return JSON.stringify(strip(a)) !== JSON.stringify(strip(b));
}
