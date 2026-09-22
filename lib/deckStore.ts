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
  updatedAt: string;
}

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
      ...(from ? { from } : {}),
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
    opacity: Math.min(1, Math.max(0, num(o.opacity, 1)))
  };
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
