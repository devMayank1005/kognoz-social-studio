/**
 * Colour, as a value rather than as a string the browser happens to understand.
 *
 * WHY THIS EXISTS AT ALL. The editor's four colour controls were native
 * `<input type="color">`, which speaks exactly one dialect: six-digit hex, no alpha. Every
 * one of them guarded with `/^#[0-9a-f]{6}$/i` and fell back to black, so a colour that was
 * genuinely `rgba(…)`, `hsl(…)` or `transparent` displayed as black while being something
 * else — the control lied about what was there. A picker with alpha, hex/RGB/HSL entry and an
 * eyedropper needs one honest parser instead of four guards.
 *
 * WHY NOT A DEPENDENCY. `colord` and friends do this well, but the repo has no colour library
 * and a strong habit of a tested pure module (`rgbToHex` in lib/richText.ts is the
 * precedent). The arithmetic below is eighty lines and every branch is covered; a dependency
 * would be more bytes and less certainty.
 *
 * TWO CONSTRAINTS THE OUTPUT MUST HOLD, both borrowed from lib/richText.ts's header:
 *
 * 1. NO DOUBLE QUOTE, EVER. These strings end up inside `style="…"`, and `sanitiseHtml`
 *    reads that attribute with a regex that stops at the delimiting quote. A stray `"` does
 *    not throw — it truncates the attribute silently, so the styling survives on screen and
 *    vanishes from the export. Nothing here can emit one, and a test asserts it across every
 *    formatter rather than trusting the reading.
 *
 * 2. CANONICAL BYTES. `normaliseSpans` merges adjacent spans by comparing their style strings
 *    byte for byte. A formatter that writes `rgba(1,2,3,.5)` once and `rgba(1, 2, 3, 0.5)`
 *    the next time quietly stops the merge working and leaves a span per edit. So every
 *    formatter here is deterministic: fixed separators, fixed rounding, no shortcuts that
 *    depend on the value.
 */

/** Channels 0–255, alpha 0–1. The one shape everything here converts through. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Hsla {
  h: number;
  s: number;
  l: number;
  a: number;
}

/**
 * The colour keywords worth knowing, and deliberately not the other ~145.
 *
 * `getComputedStyle` always hands back `rgb()`/`rgba()`, so keywords only ever reach us from
 * our own source — where `transparent` is the one in real use (lib/deckStore.ts defaults
 * `fill` and `stroke` to it, and the highlight's "None" button writes it). The rest are here
 * so a hand-edited storage row or a pasted value does not read as unparseable.
 */
const KEYWORDS: Record<string, Rgba> = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  red: { r: 255, g: 0, b: 0, a: 1 },
  lime: { r: 0, g: 255, b: 0, a: 1 },
  blue: { r: 0, g: 0, b: 255, a: 1 },
  yellow: { r: 255, g: 255, b: 0, a: 1 },
  cyan: { r: 0, g: 255, b: 255, a: 1 },
  magenta: { r: 255, g: 0, b: 255, a: 1 },
  gray: { r: 128, g: 128, b: 128, a: 1 },
  grey: { r: 128, g: 128, b: 128, a: 1 }
};

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** A channel: rounded, clamped, and never NaN — a NaN here becomes `#NaNNaNNaN` downstream. */
const channel = (n: number): number => (Number.isFinite(n) ? clamp(Math.round(n), 0, 255) : 0);

const alpha = (n: number): number => (Number.isFinite(n) ? clamp(n, 0, 1) : 1);

/**
 * Alpha as the shortest exact-enough decimal: `1`, `0`, `0.5`, `0.333`.
 *
 * Three places matter. It must be deterministic (constraint 2), it must not emit
 * `0.5000000000000001` from float arithmetic, and it must not write `.5`, which is legal CSS
 * but a second spelling of the same value — and a second spelling is how byte-identity dies.
 */
function alphaText(a: number): string {
  const rounded = Math.round(clamp(a, 0, 1) * 1000) / 1000;
  return String(rounded);
}

/** Every number in a functional colour, in order. Handles `,` `/` and space separators alike. */
function tokens(body: string): { value: number; pct: boolean }[] {
  const out: { value: number; pct: boolean }[] = [];
  for (const m of body.matchAll(/[-+]?(?:\d*\.\d+|\d+)%?/g)) {
    const raw = m[0];
    const pct = raw.endsWith("%");
    out.push({ value: Number.parseFloat(raw), pct });
  }
  return out;
}

/** Expand `#abc` / `#abcd` to their two-digit form. */
function expandHex(hex: string): string {
  return hex.length === 3 || hex.length === 4
    ? hex
        .split("")
        .map((c) => c + c)
        .join("")
    : hex;
}

/**
 * Read any colour this app can produce or be handed.
 *
 * Returns `null` rather than a silent black for something it cannot read. That distinction is
 * the point: a picker handed a value it does not understand should leave the old one alone
 * and say so, not quietly recolour the text to black — which is what the four
 * `/^#[0-9a-f]{6}$/i` guards did.
 */
export function parseColor(css: string): Rgba | null {
  if (typeof css !== "string") return null;
  const text = css.trim();
  if (!text) return null;

  const keyword = KEYWORDS[text.toLowerCase()];
  if (keyword) return { ...keyword };

  if (text.startsWith("#")) {
    const hex = expandHex(text.slice(1));
    if (!/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
    const n = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
    return {
      r: n(0),
      g: n(2),
      b: n(4),
      a: hex.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1
    };
  }

  const fn = /^(rgba?|hsla?)\s*\(([^)]*)\)$/i.exec(text);
  if (!fn) return null;
  const kind = fn[1].toLowerCase();
  const parts = tokens(fn[2]);
  if (parts.length < 3) return null;

  // Alpha may be written 0–1 or as a percentage, in either syntax.
  const a = parts.length > 3 ? alpha(parts[3].pct ? parts[3].value / 100 : parts[3].value) : 1;

  if (kind === "rgb" || kind === "rgba") {
    // Channels may be percentages too: `rgb(100% 0% 0%)` is red.
    const ch = (t: { value: number; pct: boolean }) => channel(t.pct ? (t.value / 100) * 255 : t.value);
    return { r: ch(parts[0]), g: ch(parts[1]), b: ch(parts[2]), a };
  }

  return hslToRgb(parts[0].value, parts[1].value, parts[2].value, a);
}

/** `#rrggbb`, or `#rrggbbaa` when the colour is not fully opaque. Always lower case. */
export function toHex(c: Rgba): string {
  const pair = (n: number) => channel(n).toString(16).padStart(2, "0");
  const base = `#${pair(c.r)}${pair(c.g)}${pair(c.b)}`;
  const a = alpha(c.a);
  if (a >= 1) return base;
  return base + Math.round(a * 255).toString(16).padStart(2, "0");
}

/** `rgb(r, g, b)`, or `rgba(r, g, b, a)` when translucent. */
export function toRgbString(c: Rgba): string {
  const [r, g, b] = [channel(c.r), channel(c.g), channel(c.b)];
  const a = alpha(c.a);
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alphaText(a)})`;
}

/** `hsl(h, s%, l%)`, or `hsla(…)` when translucent. Legacy comma syntax — the widest support. */
export function toHslString(c: Rgba): string {
  const { h, s, l } = rgbToHsl(c);
  const a = alpha(c.a);
  const body = `${h}, ${s}%, ${l}%`;
  return a >= 1 ? `hsl(${body})` : `hsla(${body}, ${alphaText(a)})`;
}

/** Hue 0–359, saturation and lightness 0–100, all integers so the formatters stay canonical. */
export function rgbToHsl(c: Rgba): Hsla {
  const r = channel(c.r) / 255;
  const g = channel(c.g) / 255;
  const b = channel(c.b) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (span !== 0) {
    s = span / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / span) % 6;
    else if (max === g) h = (b - r) / span + 2;
    else h = (r - g) / span + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    // 360 and 0 are the same hue; normalising avoids two spellings of one colour.
    h: Math.round(h) % 360,
    s: clamp(Math.round(s * 100), 0, 100),
    l: clamp(Math.round(l * 100), 0, 100),
    a: alpha(c.a)
  };
}

export function hslToRgb(h: number, s: number, l: number, a = 1): Rgba {
  const hue = ((Number.isFinite(h) ? h : 0) % 360 + 360) % 360;
  const sat = clamp(Number.isFinite(s) ? s : 0, 0, 100) / 100;
  const lit = clamp(Number.isFinite(l) ? l : 0, 0, 100) / 100;

  const c = (1 - Math.abs(2 * lit - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lit - c / 2;

  const seg = Math.floor(hue / 60) % 6;
  const rgb: [number, number, number] =
    seg === 0 ? [c, x, 0]
    : seg === 1 ? [x, c, 0]
    : seg === 2 ? [0, c, x]
    : seg === 3 ? [0, x, c]
    : seg === 4 ? [x, 0, c]
    : [c, 0, x];

  return {
    r: channel((rgb[0] + m) * 255),
    g: channel((rgb[1] + m) * 255),
    b: channel((rgb[2] + m) * 255),
    a: alpha(a)
  };
}

/**
 * The same colour at a different opacity.
 *
 * Opaque results come back as hex, translucent ones as `rgba()`. That split is deliberate:
 * eight-digit hex stores alpha in 8 bits, so a slider set to 50% would read back as 50.2%
 * and the number under somebody's cursor would drift as they dragged. `rgba()` keeps the
 * value they actually chose. Both forms are far inside the 64-character truncation
 * lib/deckStore.ts applies to colour fields without saying so.
 *
 * Returns the input untouched when it cannot be read, so a control can never blank a value
 * it merely failed to parse.
 */
export function withAlpha(css: string, a: number): string {
  const c = parseColor(css);
  if (!c) return css;
  const next = { ...c, a: alpha(a) };
  return next.a >= 1 ? toHex(next) : toRgbString(next);
}

/** True for `transparent` and for anything that parses to zero alpha. */
export function isTransparent(css: string): boolean {
  const c = parseColor(css);
  return c ? c.a === 0 : false;
}

/**
 * The alpha of a colour, or 1 when it has none or cannot be read.
 *
 * Separate from `parseColor` because the alpha slider needs a number even while the text
 * field holds something half-typed.
 */
export function alphaOf(css: string): number {
  return parseColor(css)?.a ?? 1;
}

/**
 * Split a colour into the parts an SVG paint attribute wants.
 *
 * SVG `fill`/`stop-color` take a colour, and opacity is a SEPARATE attribute. Eight-digit hex
 * is accepted by current browsers but is not what the SVG spec says, and this markup is
 * re-parsed as XML and rasterised by lib/exportPipeline.ts — a place where "current browsers
 * accept it" has already cost this project once. So the alpha comes out as its own value.
 */
export function svgPaint(css: string): { color: string; opacity: number } {
  const c = parseColor(css);
  if (!c) return { color: css, opacity: 1 };
  return { color: toHex({ ...c, a: 1 }), opacity: c.a };
}
