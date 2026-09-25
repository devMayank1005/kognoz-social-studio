/**
 * Styling a RANGE of characters rather than a whole text element.
 *
 * The pure half of per-range styling. The impure half — reading `window.getSelection()`,
 * wrapping a live Range in a span — belongs to the editor, because the markup being styled
 * is a live `contentEditable` subtree and React is deliberately not allowed to own it while
 * a caret is in it (see components/slide/ElementLayer.tsx).
 *
 * WHY SPANS AND NOT A RUN MODEL. A `TextElement` could have carried an array of styled runs
 * instead. It does not, because the template already hands us markup: an ejected headline
 * arrives as the renderer wrote it, gradient `<span>` and all, and `sanitiseHtml`
 * (lib/slideElements.ts) already allows `<span style="…">` through to storage and export.
 * Spans are the format the whole pipeline already speaks; a run model would mean translating
 * in both directions and losing whatever the template did that the model could not express.
 *
 * ONE HARD CONSTRAINT ON OUTPUT. `sanitiseHtml` reads the style attribute with
 * `/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/` — the value may not contain the quote character
 * that delimits it. Font stacks contain single quotes (`'Fraunces', serif`), so every style
 * attribute this app emits must be DOUBLE quoted, and any double quote inside a value is
 * rewritten to a single one. Get this wrong and the attribute is silently truncated at the
 * stray quote: the styling survives on screen and disappears from the export.
 */

/**
 * Everything the typography toolbar can set on a run.
 *
 * ORDER IS LOAD-BEARING. `runStyleToCss` walks this array, so it is what makes the same
 * patch serialise to a byte-identical string every time — and `normaliseSpans` merges
 * adjacent spans by comparing those strings. Reorder this and the merge quietly stops
 * working, leaving a span per edit.
 *
 * Block properties are deliberately absent: `text-align`, `line-height` and paragraph
 * spacing cannot mean anything on a range of characters, so they stay on the element.
 */
export const RUN_KEYS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "color",
  "backgroundColor",
  "textDecorationLine",
  "textTransform",
  "letterSpacing",
  "opacity",
  "verticalAlign",
  "textShadow",
  "webkitTextStroke",
  "backgroundImage",
  "webkitBackgroundClip",
  "backgroundClip",
  "direction"
] as const;

export type RunKey = (typeof RUN_KEYS)[number];

export interface RunStyle {
  fontFamily?: string;
  /** Base pixels, like every other size in this app. */
  fontSize?: number;
  fontWeight?: number;
  /** `italic` only when the family actually serves one — see lib/fontCatalogue.ts hasFace. */
  fontStyle?: "normal" | "italic";
  color?: string;
  /** The highlight behind the characters. */
  backgroundColor?: string;
  /** Space-separated: "underline", "line-through", "overline", or "none". */
  textDecorationLine?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  /** Base pixels. Negative is legitimate for tight display type. */
  letterSpacing?: number;
  opacity?: number;
  /** Superscript and subscript. The caller shrinks fontSize to match. */
  verticalAlign?: "baseline" | "super" | "sub";
  textShadow?: string;
  /** `-webkit-text-stroke`, e.g. "2px #000". Outline type. */
  webkitTextStroke?: string;
  /**
   * Gradient text is these two plus `color: transparent`, and the ORDER MATTERS: `background`
   * is a shorthand that resets `background-clip`, which is why this uses the longhand
   * `background-image`. components/Slide.tsx documents the same trap for the template's
   * gradient word, and two tests pin the declaration order there.
   */
  backgroundImage?: string;
  /**
   * BOTH spellings of the clip are written, and that is not belt-and-braces.
   *
   * components/Slide.tsx:28 sets `WebkitBackgroundClip` and `backgroundClip` together for
   * the template's own gradient word. A range gradient that emitted only the unprefixed one
   * was a spelling short of the template it sits next to — fine in Chrome, a solid
   * transparent block anywhere the prefix is still required, including whatever renders the
   * exported SVG.
   */
  webkitBackgroundClip?: string;
  backgroundClip?: string;
  direction?: "ltr" | "rtl";
}

const CSS_NAME: Record<RunKey, string> = {
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  fontStyle: "font-style",
  color: "color",
  backgroundColor: "background-color",
  textDecorationLine: "text-decoration-line",
  textTransform: "text-transform",
  letterSpacing: "letter-spacing",
  opacity: "opacity",
  verticalAlign: "vertical-align",
  textShadow: "text-shadow",
  // Both spellings: the unprefixed one is not supported everywhere the prefixed one is, and
  // the export rasterises through the browser's own engine, so whatever it honours wins.
  webkitTextStroke: "-webkit-text-stroke",
  backgroundImage: "background-image",
  webkitBackgroundClip: "-webkit-background-clip",
  backgroundClip: "background-clip",
  direction: "direction"
};

/** Keys whose numeric value is in pixels. Everything else is written verbatim. */
const PX_KEYS = new Set<RunKey>(["fontSize", "letterSpacing"]);

/** `"` → `'`, so the value can never close the attribute that holds it. See the header. */
function quoteSafe(value: string): string {
  return value.replace(/"/g, "'");
}

/**
 * A style attribute value for one run — always safe to write inside `style="…"`.
 *
 * Returns "" for an empty patch, which callers read as "nothing to apply, do not wrap".
 */
export function runStyleToCss(style: RunStyle): string {
  const parts: string[] = [];
  for (const key of RUN_KEYS) {
    const value = style[key];
    if (value === undefined || value === null || value === "") continue;
    const css = PX_KEYS.has(key) ? `${value}px` : String(value);
    parts.push(`${CSS_NAME[key]}: ${quoteSafe(css)}`);
  }
  return parts.join("; ");
}

/**
 * The inverse, for showing the bar what the selection already carries.
 *
 * Only the keys in RUN_KEYS are read. Anything else a span carries is ignored rather than
 * dropped — this function never writes the markup back, so what it cannot name is simply
 * not its business.
 */
export function parseRunStyle(css: string): RunStyle {
  const out: RunStyle = {};
  if (!css) return out;
  for (const decl of css.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const raw = decl.slice(idx + 1).trim();
    if (!raw) continue;
    const num = () => {
      const n = Number.parseFloat(raw);
      return Number.isFinite(n) ? n : undefined;
    };
    switch (prop) {
      case "font-family": out.fontFamily = raw; break;
      case "color": out.color = raw; break;
      case "background-color": out.backgroundColor = raw; break;
      case "text-decoration-line": out.textDecorationLine = raw; break;
      case "text-transform": out.textTransform = raw as RunStyle["textTransform"]; break;
      case "font-style": out.fontStyle = raw as RunStyle["fontStyle"]; break;
      case "vertical-align": out.verticalAlign = raw as RunStyle["verticalAlign"]; break;
      case "text-shadow": out.textShadow = raw; break;
      case "-webkit-text-stroke": out.webkitTextStroke = raw; break;
      case "background-image": out.backgroundImage = raw; break;
      case "-webkit-background-clip": out.webkitBackgroundClip = raw; break;
      case "background-clip": out.backgroundClip = raw; break;
      case "direction": out.direction = raw as RunStyle["direction"]; break;
      case "font-size": { const n = num(); if (n !== undefined) out.fontSize = n; break; }
      case "font-weight": { const n = num(); if (n !== undefined) out.fontWeight = n; break; }
      case "letter-spacing": { const n = num(); if (n !== undefined) out.letterSpacing = n; break; }
      case "opacity": { const n = num(); if (n !== undefined) out.opacity = n; break; }
      default: break;
    }
  }
  return out;
}

/** `patch` wins, but only where it actually says something. */
export function mergeRunStyle(base: RunStyle, patch: RunStyle): RunStyle {
  const out: RunStyle = { ...base };
  for (const key of RUN_KEYS) {
    const value = patch[key];
    if (value === undefined || value === null || value === "") continue;
    // TypeScript cannot see that key and value agree; they do, by construction of RunStyle.
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** True when two runs would render identically, for the merge pass below. */
export function sameRunStyle(a: RunStyle, b: RunStyle): boolean {
  return RUN_KEYS.every((key) => a[key] === b[key]);
}

/**
 * Tidy the markup that repeated styling leaves behind.
 *
 * Styling a range wraps it in a span. Style two neighbouring words separately and you get two
 * adjacent spans that say the same thing; style something and then undo it and you get spans
 * with nothing in them. Both render correctly and both accumulate, so the stored `html` grows
 * every time somebody fiddles.
 *
 * NESTING WITH DIFFERENT STYLES IS LEFT ALONE on purpose.
 * `<span style="color:red"><span style="font-weight:700">` is not redundant — the inner span
 * is a narrower range than the outer one, and the cascade already resolves it correctly.
 * Flattening that would need a real parse and would risk changing what renders.
 *
 * A span wrapping nothing but an IDENTICAL span is different: it is provably a no-op, and it
 * is what the browser produces when you restyle a range you already styled the same way —
 * `<span style="color:#B52879"><span style="color:#B52879">Culture</span></span>` after
 * pressing the same swatch twice. Observed in the running app, which is why it is here.
 *
 * BLOCK SPANS ARE NEVER MERGED. `renderLines` draws each body line as its own
 * `display:block` span, and every line after the first carries the same style string. Those
 * are separate lines, not duplicates: merging them joined lines 2..N into one on every commit.
 *
 * WHITESPACE IS NEVER DROPPED. Text elements render with `white-space: pre-wrap`, so a span
 * holding only spaces, or spaces between two spans, is visible spacing the person typed.
 */
const isBlockSpan = (attrs: string) => /display\s*:\s*block/i.test(attrs);

export function normaliseSpans(html: string): string {
  if (!html) return "";
  let out = html;
  let before: string;
  do {
    before = out;
    out = out
      // An empty span renders nothing at all. EMPTY, not whitespace-only: the editor is
      // `white-space: pre-wrap`, so spaces and newlines are content somebody typed.
      .replace(/<span\b[^>]*><\/span>/gi, "")
      // A span whose only child is a byte-identical span is one span. No `\s*` around the
      // inner span for the same reason — whitespace there is text, and it renders.
      .replace(
        /<span([^>]*)><span\1>([\s\S]*?)<\/span><\/span>/gi,
        (full, attrs: string, inner: string) => (isBlockSpan(attrs) ? full : `<span${attrs}>${inner}</span>`)
      )
      // Two adjacent spans with byte-identical attributes are one span.
      .replace(
        /<span([^>]*)>([\s\S]*?)<\/span><span\1>([\s\S]*?)<\/span>/gi,
        (full, attrs: string, first: string, second: string) =>
          isBlockSpan(attrs) ? full : `<span${attrs}>${first}${second}</span>`
      );
  } while (out !== before);
  return out;
}

/**
 * `rgb(11, 31, 51)` → `#0b1f33`.
 *
 * `getComputedStyle().color` always resolves to an rgb() string, and `<input type="color">`
 * only accepts `#rrggbb`. Without this the swatch resets itself to black the moment you open
 * it over a selection, which reads as "the editor forgot what colour this was".
 *
 * Anything that is not an rgb()/rgba() triple is passed through untouched, so a value that
 * is already hex — or a keyword this app wrote itself — survives.
 */
export function rgbToHex(value: string): string {
  // The minus is accepted so the clamp below is real rather than decorative. Fractions are
  // accepted because a computed colour genuinely can carry them (color-mix, relative colours).
  const m = /^rgba?\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)/i.exec(value.trim());
  if (!m) return value;
  const hex = [m[1], m[2], m[3]]
    .map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

/**
 * The family name out of a CSS stack: `"'Fraunces', serif"` → `fraunces`.
 *
 * `getComputedStyle().fontFamily` re-serialises the stack — quotes and spacing are the
 * browser's, not ours — so matching a computed value against a picker option by string
 * equality fails on stacks that are the same font. Comparing the first family, unquoted and
 * lowercased, is what actually answers "is this that font".
 */
export function firstFamily(stack: string): string {
  return (stack.split(",")[0] ?? "").replace(/['"]/g, "").trim().toLowerCase();
}

/** True when two CSS font stacks name the same primary family. */
export function sameFamily(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return firstFamily(a) === firstFamily(b);
}

/* ------------------------------------------------------------------------------------ *
 * Toggles
 *
 * A toolbar button has to know what the selection already carries so it can turn a thing
 * OFF as well as on. These are the small amount of reasoning that takes.
 * ------------------------------------------------------------------------------------ */

export type Decoration = "underline" | "line-through" | "overline";

export function hasDecoration(style: RunStyle, which: Decoration): boolean {
  return (style.textDecorationLine ?? "").split(/\s+/).includes(which);
}

/** Add or remove one decoration, leaving the others alone. */
export function toggleDecoration(style: RunStyle, which: Decoration): string {
  const parts = new Set((style.textDecorationLine ?? "").split(/\s+/).filter((p) => p && p !== "none"));
  if (parts.has(which)) parts.delete(which);
  else parts.add(which);
  // "none", not "": an empty value would be dropped by runStyleToCss, which means the span
  // keeps whatever it inherits and the button appears not to work.
  return parts.size ? [...parts].join(" ") : "none";
}

/** Gradient text is four declarations that only work together. */
export function gradientRun(css: string): RunStyle {
  return {
    backgroundImage: css,
    webkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent"
  };
}

export function isGradient(style: RunStyle): boolean {
  return Boolean(style.backgroundImage && style.backgroundImage !== "none");
}

/** Undo a gradient without also clearing whatever colour was under it. */
export function clearGradient(color: string): RunStyle {
  return {
    backgroundImage: "none",
    webkitBackgroundClip: "border-box",
    backgroundClip: "border-box",
    color
  };
}

/**
 * Super and subscript, which are a baseline shift AND a size change.
 *
 * Without shrinking the text a "superscript" just sits high and looks like a mistake;
 * 0.65 is the ratio browsers use for <sup> themselves.
 */
export function scriptRun(kind: "super" | "sub" | "baseline", baseSize: number): RunStyle {
  if (kind === "baseline") return { verticalAlign: "baseline", fontSize: baseSize };
  return { verticalAlign: kind, fontSize: Math.max(1, Math.round(baseSize * 0.65)) };
}

/**
 * Every font family named inside a run's markup.
 *
 * WHY THIS EXISTS. An element carries one `fontFamily`, but per-range styling puts others
 * inside its `html` as `<span style="font-family: …">`. The exporter embeds fonts by asking
 * which families a deck uses, and if it only asks the ELEMENT it will miss every family
 * applied to a selection — the word renders correctly on screen and falls back to a system
 * face in the downloaded file. That is precisely the class of bug lib/fontRegistry.ts was
 * written to make impossible, and per-range styling reintroduced it through the back door.
 *
 * Regex rather than a parse because this runs in the export path and in node tests alike,
 * and the markup it reads is our own output, already narrowed by sanitiseHtml.
 */
export function familiesInHtml(html: string): string[] {
  if (!html) return [];
  const out = new Set<string>();
  // Stops at `;` or the attribute's own `"` — NOT at `'`, because a font stack legitimately
  // contains single quotes (`'Playfair Display', serif`) and excluding them matches nothing.
  for (const m of html.matchAll(/font-family\s*:\s*([^;"]+)/gi)) {
    const value = m[1].trim();
    if (value) out.add(value);
  }
  return [...out];
}

/** Every font weight named inside a run's markup. Companion to familiesInHtml. */
export function weightsInHtml(html: string): number[] {
  if (!html) return [];
  const out = new Set<number>();
  for (const m of html.matchAll(/font-weight\s*:\s*([^;"]+)/gi)) {
    const n = Number.parseFloat(m[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 1000) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/** Whether any run inside this markup is italic. */
export function hasItalicInHtml(html: string): boolean {
  return /font-style\s*:\s*italic/i.test(html ?? "");
}
