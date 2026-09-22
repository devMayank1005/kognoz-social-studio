// Reading a template element off the rendered slide, so it can become a free object.
//
// This is the half of "unlock" that has to touch the DOM. It measures, it never mutates —
// hiding the original is components/studio/SlideCanvas.tsx's job, and building the element
// is lib/slideElements.ts's.
//
// It measures the HIDDEN FULL-SIZE EXPORT COPY (#exp-N), not the preview, on purpose. The
// preview sits under a CSS `scale(previewScale)`, so every rect read from it comes back
// multiplied by a fraction that changes with the window width; the export copy renders at
// exactly baseW x baseH, so a rect read from it is already in slide pixels and needs no
// division and no rounding. The two trees render from the same state, so they agree.

import { sanitiseHtml, textOfHtml, type TemplateSlot } from "./slideElements";

// What it captures, and why it is markup rather than text.
//
// The template does not render plain strings. `renderEmWith` turns a starred word into a
// `<span>` carrying a clipped gradient, and `renderLines` turns each line of a body into its
// own `display:block` span. Reading `textContent` loses both: the gradient word comes out
// flat black, and a two-line body comes out as "Line oneLine two" with nothing between them,
// because textContent concatenates block-level children without a separator.
//
// So the markup is taken and sanitised instead, and an unlocked element is a pixel-identical
// copy of what it replaced. `text` is kept alongside it as the plain-text reading, with the
// line breaks put back.

export interface SlotHit {
  slot: TemplateSlot;
  /** Which instance of that slot, when the template marked one. See TextElement.slotKey. */
  key?: string;
  /** Slide pixels, relative to the export root. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The rendered markup, sanitised. What the element actually draws. */
  html: string;
  /** The same content as plain text, line breaks intact. */
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
}

const SLOTS: TemplateSlot[] = ["eyebrow", "headline", "body", "cta", "kicker", "number"];

function weightOf(v: string): number {
  if (v === "bold") return 700;
  if (v === "normal") return 400;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 400;
}

function alignOf(v: string): "left" | "center" | "right" {
  if (v === "center") return "center";
  if (v === "right" || v === "end") return "right";
  // "start" and "justify" both read as left-aligned once the text is a free object.
  return "left";
}

/**
 * The template element under this point, if any.
 *
 * Returns the SMALLEST match, because the marked nodes nest: a body paragraph sits inside
 * a column that may itself be marked, and the thing a person meant to click is the
 * innermost one they can see.
 */
export function slotAt(root: HTMLElement, bx: number, by: number): SlotHit | null {
  const rootRect = root.getBoundingClientRect();
  let best: SlotHit | null = null;
  let bestArea = Infinity;

  for (const node of Array.from(root.querySelectorAll<HTMLElement>("[data-slot]"))) {
    const name = node.dataset.slot as TemplateSlot | undefined;
    if (!name || !SLOTS.includes(name)) continue;
    // Already ejected: SlideCanvas has hidden it, and its copy is on the canvas instead.
    if (node.style.visibility === "hidden") continue;
    const key = node.dataset.slotKey || undefined;

    const r = node.getBoundingClientRect();
    const x = r.left - rootRect.left;
    const y = r.top - rootRect.top;
    if (r.width <= 0 || r.height <= 0) continue;
    if (bx < x || bx > x + r.width || by < y || by > y + r.height) continue;

    const area = r.width * r.height;
    if (area >= bestArea) continue;

    const html = sanitiseHtml(node.innerHTML ?? "");
    const cs = getComputedStyle(node);
    const fontSize = parseFloat(cs.fontSize) || 16;
    const lh = parseFloat(cs.lineHeight);
    bestArea = area;
    best = {
      slot: name,
      ...(key ? { key } : {}),
      x,
      y,
      w: r.width,
      h: r.height,
      html,
      text: textOfHtml(html),
      fontFamily: cs.fontFamily,
      fontSize,
      fontWeight: weightOf(cs.fontWeight),
      color: cs.color,
      align: alignOf(cs.textAlign),
      // "normal" parses to NaN; 1.2 is what browsers use for it in practice.
      lineHeight: Number.isFinite(lh) && fontSize > 0 ? lh / fontSize : 1.2
    };
  }

  return best;
}
