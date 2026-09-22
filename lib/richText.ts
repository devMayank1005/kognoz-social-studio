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

/** The properties the styling bar can set on a run. Deliberately the same four it already
 *  sets on a whole element, so there is one mental model rather than two. */
export const RUN_KEYS = ["fontFamily", "fontSize", "fontWeight", "color"] as const;

export type RunKey = (typeof RUN_KEYS)[number];

export interface RunStyle {
  fontFamily?: string;
  /** Base pixels, like every other size in this app. */
  fontSize?: number;
  fontWeight?: number;
  color?: string;
}

const CSS_NAME: Record<RunKey, string> = {
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  color: "color"
};

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
    const css = key === "fontSize" ? `${value}px` : String(value);
    parts.push(`${CSS_NAME[key]}: ${quoteSafe(css)}`);
  }
  return parts.join("; ");
}

/**
 * The inverse, for showing the bar what the selection already carries.
 *
 * Only the four keys are read; anything else the template put on the span — a gradient's
 * `background-image` and `background-clip`, say — is ignored here rather than dropped,
 * because this function never writes the markup back.
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
    if (prop === "font-family") out.fontFamily = raw;
    else if (prop === "color") out.color = raw;
    else if (prop === "font-size") {
      const n = Number.parseFloat(raw);
      if (Number.isFinite(n)) out.fontSize = n;
    } else if (prop === "font-weight") {
      const n = Number.parseFloat(raw);
      if (Number.isFinite(n)) out.fontWeight = n;
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
 * NESTING IS LEFT ALONE on purpose. `<span style="color:red"><span style="font-weight:700">`
 * is not redundant — the inner span is a narrower range than the outer one, and the cascade
 * already resolves it correctly. Flattening it would need a real parse and would risk
 * changing what renders; this pass only removes things that are provably no-ops.
 */
export function normaliseSpans(html: string): string {
  if (!html) return "";
  let out = html;
  let before: string;
  do {
    before = out;
    out = out
      // An empty span renders nothing at all.
      .replace(/<span\b[^>]*>\s*<\/span>/gi, "")
      // Two adjacent spans with byte-identical attributes are one span.
      .replace(
        /<span([^>]*)>([\s\S]*?)<\/span><span\1>([\s\S]*?)<\/span>/gi,
        (_full, attrs: string, first: string, second: string) => `<span${attrs}>${first}${second}</span>`
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
