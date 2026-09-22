/**
 * Gradients as a structure, not as a string.
 *
 * WHY STRUCTURED, WHEN CSS ALREADY HAS A PERFECTLY GOOD SYNTAX. lib/deckStore.ts coerces
 * every colour field with `str(value, 64)` — a silent 64-character truncation. A three-stop
 * gradient is 62 characters and squeaks under it; a four-stop one is 75 and is cut mid-token
 * into CSS that is invalid but still looks plausible. That failure does not appear when you
 * draw the gradient. It appears on the NEXT LOAD, which is exactly how the shape library
 * lost its new shapes before anyone noticed.
 *
 * A `{ type, angle, stops[] }` object with clamped numbers and a capped stop count cannot be
 * truncated into something that looks valid, so the storage layer can check it rather than
 * hope. The CSS string is then generated on the way out, never stored.
 *
 * TWO SURFACES, ONE MODEL. Text gradients are CSS on a `<span>` (`background-image` +
 * `background-clip: text`, which lib/richText.ts's `gradientRun` already builds). Shape
 * gradients are SVG `<defs><linearGradient>` plus `fill="url(#id)"` — a presentation
 * attribute cannot take `linear-gradient(…)` at all. Both are driven from this one type.
 *
 * CANONICAL OUTPUT IS LOAD-BEARING, for the reason lib/richText.ts's header gives:
 * `normaliseSpans` merges adjacent spans by comparing their style strings byte for byte, so
 * a serialiser with two spellings of one gradient quietly stops the merge working and leaves
 * a span per edit. `gradientCss` therefore always writes explicit positions, always `deg`,
 * always `", "`.
 */

import { parseColor, toHex, toRgbString } from "./color";

export interface GradientStop {
  color: string;
  /** Position along the gradient line, 0–100. */
  at: number;
}

export interface Gradient {
  type: "linear" | "radial";
  /** CSS convention: 0 = upward, 90 = rightward, increasing clockwise. Ignored when radial. */
  angle: number;
  stops: GradientStop[];
}

/** Two is a gradient; one is a colour with extra steps. */
export const MIN_STOPS = 2;

/**
 * Eight is not a CSS limit — it is a storage one.
 *
 * Each stop is roughly 25 characters of JSON, and the whole deck is a single jsonb blob with
 * a 4 MB autosave ceiling (DECK_PAYLOAD_LIMIT). A cap here means a pasted or hand-edited row
 * cannot put a thousand stops on one shape and push a deck over it.
 */
export const MAX_STOPS = 8;

const clamp = (n: number, lo: number, hi: number): number =>
  Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;

/** Split on commas that are not inside parentheses — `rgba(1, 2, 3, 0.5)` is one token. */
function splitTop(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(body.slice(start, i));
      start = i + 1;
    }
  }
  out.push(body.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** The keyword directions CSS allows in place of an angle. */
const DIRECTIONS: Record<string, number> = {
  "to top": 0,
  "to right": 90,
  "to bottom": 180,
  "to left": 270,
  "to top right": 45,
  "to right top": 45,
  "to bottom right": 135,
  "to right bottom": 135,
  "to bottom left": 225,
  "to left bottom": 225,
  "to top left": 315,
  "to left top": 315
};

/**
 * Put a gradient into the one shape the rest of the app may assume.
 *
 * Sorts by position, clamps every number into range and caps the stop count. Callers hand
 * this whatever a person dragged or a stored row claimed; everything downstream can then
 * take the result at face value.
 */
export function normaliseGradient(g: Gradient): Gradient {
  const stops = g.stops
    .filter((s) => s && typeof s.color === "string" && s.color.trim() !== "")
    .map((s) => ({ color: s.color.trim(), at: clamp(Math.round(s.at), 0, 100) }))
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_STOPS);

  return {
    type: g.type === "radial" ? "radial" : "linear",
    // Wrapped, not clamped. 360 and 0 are the same direction, and so are 9999 and 279 —
    // clamping to some bound first would fold a legal-if-odd angle onto a different one.
    angle: Number.isFinite(g.angle) ? (((Math.round(g.angle) % 360) + 360) % 360) : 0,
    stops
  };
}

/** True when this is something the renderer can actually draw. */
export function isDrawableGradient(g: Gradient | undefined | null): g is Gradient {
  return Boolean(g && Array.isArray(g.stops) && g.stops.length >= MIN_STOPS);
}

/**
 * The CSS for a text gradient. Always the same bytes for the same gradient — see the header.
 *
 * Colours are re-serialised through lib/color.ts rather than passed through, so a stop
 * written `#ABC` one day and `rgb(170, 187, 204)` the next lands as one string and the span
 * merge keeps working.
 */
export function gradientCss(g: Gradient): string {
  const norm = normaliseGradient(g);
  const stops = norm.stops
    .map((s) => {
      const c = parseColor(s.color);
      const colour = c ? (c.a >= 1 ? toHex(c) : toRgbString(c)) : s.color;
      return `${colour} ${s.at}%`;
    })
    .join(", ");

  return norm.type === "radial"
    ? `radial-gradient(circle, ${stops})`
    : `linear-gradient(${norm.angle}deg, ${stops})`;
}

/**
 * Read a gradient back out of CSS, so the editor can open on what is already there rather
 * than resetting to the brand default.
 *
 * Handles what the brand constants in lib/tokens.ts actually look like, which includes the
 * form `linear-gradient(<angle>deg, <from>, <to>)` — two stops and no positions at all.
 * Stops without a position are spread evenly, which is what the browser does with them.
 * (The real values are not quoted here: lib/designTokens.test.ts lints every file for brand
 * hexes, comments included, because a hex in a comment is a hex somebody copies into code.)
 */
export function parseGradientCss(css: string): Gradient | null {
  if (typeof css !== "string") return null;
  const m = /^\s*(linear|radial)-gradient\s*\(([\s\S]*)\)\s*$/i.exec(css.trim());
  if (!m) return null;

  const type = m[1].toLowerCase() as "linear" | "radial";
  const parts = splitTop(m[2]);
  if (!parts.length) return null;

  let angle = type === "radial" ? 0 : 180; // CSS default is `to bottom`.
  let first = 0;

  // A leading segment that is not a colour is the angle, the direction, or a radial shape
  // and position. Detecting it by "does this parse as a colour" rather than by pattern keeps
  // `circle at 30% 40%` and `to bottom right` working without a case for each.
  const head = parts[0];
  if (!parseColor(head.replace(/\s+\d[\d.]*%?\s*$/, "").trim())) {
    first = 1;
    const deg = /^([-+]?[\d.]+)deg$/i.exec(head);
    const turn = /^([-+]?[\d.]+)turn$/i.exec(head);
    if (deg) angle = Number.parseFloat(deg[1]);
    else if (turn) angle = Number.parseFloat(turn[1]) * 360;
    else if (DIRECTIONS[head.toLowerCase()] !== undefined) angle = DIRECTIONS[head.toLowerCase()];
  }

  const raw = parts.slice(first);
  if (raw.length < MIN_STOPS) return null;

  const stops: GradientStop[] = [];
  raw.forEach((part, i) => {
    // The position, when present, is the trailing percentage — the colour may itself contain
    // percentages, as `hsl(210 100% 40%)` does, so this anchors to the end.
    const pos = /\s+([-+]?[\d.]+)%\s*$/.exec(part);
    const colour = (pos ? part.slice(0, pos.index) : part).trim();
    if (!colour) return;
    stops.push({
      color: colour,
      at: pos ? Number.parseFloat(pos[1]) : (i / (raw.length - 1)) * 100
    });
  });

  if (stops.length < MIN_STOPS) return null;
  return normaliseGradient({ type, angle, stops });
}

/**
 * A CSS angle as the SVG `x1/y1/x2/y2` of a `<linearGradient>`.
 *
 * The two systems disagree twice over, which is why this is a function with a test table
 * rather than two lines at the call site. CSS measures from "up" and turns clockwise; SVG
 * wants two points. And SVG's y axis runs down the screen, so "up" is negative.
 *
 * The half-length is `(|sin| + |cos|) / 2` — the CSS gradient-line length for a unit box —
 * so a 45° gradient reaches the corners instead of stopping short of them.
 */
export function svgGradientCoords(angle: number): { x1: string; y1: string; x2: string; y2: string } {
  const rad = ((((angle % 360) + 360) % 360) * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(dx) + Math.abs(dy)) / 2;

  // Four decimals: enough that no rounding is visible, few enough that the attribute string
  // is the same every render and the export diff stays quiet.
  const fmt = (n: number) => String(Math.round(n * 10000) / 10000);
  return {
    x1: fmt(0.5 - dx * half),
    y1: fmt(0.5 - dy * half),
    x2: fmt(0.5 + dx * half),
    y2: fmt(0.5 + dy * half)
  };
}

/** A sensible two-stop gradient to open the editor on when there is nothing to read. */
export function defaultGradient(from: string, to: string): Gradient {
  return { type: "linear", angle: 90, stops: [{ color: from, at: 0 }, { color: to, at: 100 }] };
}
