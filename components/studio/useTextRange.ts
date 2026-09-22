"use client";

// The live text selection inside whichever element is being edited, and the one operation
// that acts on it.
//
// This is deliberately NOT in CanvasEditor. That file owns pointer gestures over the whole
// slide; this owns a caret inside one node, and the two only meet through `editingId`.
//
// It works on the live DOM rather than on React state, for the same reason the editable
// itself does (see components/slide/ElementLayer.tsx): React is not allowed to own the
// children of a contentEditable while a caret is in it, because re-rendering them collapses
// the selection on every keystroke. So styling mutates the node, and the existing commit —
// blur or Escape, reading `innerHTML` — carries the result into the element exactly as it
// already carries typed words.

import { useCallback, useEffect, useRef, useState } from "react";
import { runStyleToCss, type RunStyle } from "@/lib/richText";
import { parseColor, toHex, toRgbString } from "@/lib/color";

export interface TextRangeSelection {
  /** Characters selected. Shown on the bar so it is obvious what a control is about to hit. */
  length: number;
  /** Resolved style under the selection, so the controls show what is really there. */
  style: RunStyle;
}

/** The same node CanvasEditor's click-away listener looks up, by the same selector. */
function editableNode(editingId: string | null): HTMLElement | null {
  if (!editingId) return null;
  return document.querySelector<HTMLElement>(`#preview-slide [data-el-id="${editingId}"]`);
}

/** A computed colour in the one spelling the rest of the app writes. Alpha is kept. */
function readColour(value: string): string | undefined {
  const c = parseColor(value);
  if (!c) return value || undefined;
  return c.a >= 1 ? toHex(c) : toRgbString(c);
}

/**
 * The first ancestor between the caret and the text box that actually SETS this property.
 *
 * Needed because neither `background-color` nor `background-image` inherits. Reading the
 * computed style of the node under the caret reports "no background" for a word sitting
 * plainly on a highlight, which would make the highlight control claim nothing was there and
 * then clear it. Climbing to the host answers the question that was actually being asked:
 * what is behind this text.
 */
function climb(from: Element | null, host: Element, read: (cs: CSSStyleDeclaration) => string): string | undefined {
  let el: Element | null = from;
  while (el) {
    const value = read(window.getComputedStyle(el));
    if (value && value !== "none" && value !== "rgba(0, 0, 0, 0)" && value !== "transparent") return value;
    if (el === host) break;
    el = el.parentElement;
  }
  return undefined;
}

function styleOf(range: Range, host: Element): RunStyle {
  const node = range.startContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) return {};
  const cs = window.getComputedStyle(el);
  const size = Number.parseFloat(cs.fontSize);
  const weight = Number.parseInt(cs.fontWeight, 10);

  const background = climb(el, host, (s) => s.backgroundColor);
  const image = climb(el, host, (s) => s.backgroundImage);

  return {
    fontFamily: cs.fontFamily || undefined,
    fontSize: Number.isFinite(size) ? Math.round(size) : undefined,
    fontWeight: Number.isFinite(weight) ? weight : undefined,
    // Computed colour is always an rgb()/rgba() string; everything downstream speaks hex,
    // or rgba() when there is alpha to keep.
    color: readColour(cs.color),
    // THESE TWO ARE WHY THE GRADIENT BUTTON NEVER WORKED. `isGradient` asks for
    // backgroundImage and this function did not report it, so the toggle read false over
    // text that was already a gradient: it showed un-pressed, and `clearGradient` was
    // unreachable. You could apply a gradient and never take it off again.
    backgroundColor: background ? readColour(background) : undefined,
    backgroundImage: image
  };
}

export function useTextRange(editingId: string | null) {
  const rangeRef = useRef<Range | null>(null);
  const [selection, setSelection] = useState<TextRangeSelection | null>(null);

  useEffect(() => {
    if (!editingId) {
      rangeRef.current = null;
      setSelection(null);
      return;
    }

    const read = () => {
      const host = editableNode(editingId);
      if (!host) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      // Focus moved somewhere outside the text — almost always the styling bar itself.
      // Keep the range we had: the whole point is to act on it from over there.
      if (!host.contains(range.commonAncestorContainer)) return;

      // Collapsed *inside* the text is different: the person moved the caret, so there is
      // genuinely no range any more and the bar should go back to whole-element mode.
      if (sel.isCollapsed) {
        rangeRef.current = null;
        setSelection(null);
        return;
      }

      rangeRef.current = range.cloneRange();
      setSelection({ length: range.toString().length, style: styleOf(range, host) });
    };

    read();
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, [editingId]);

  /**
   * Wrap the saved range in a styled span.
   *
   * Returns false when there was nothing to act on, which is the caller's signal to fall
   * back to patching the whole element.
   */
  const applyRunStyle = useCallback(
    (patch: RunStyle): boolean => {
      const host = editableNode(editingId);
      const range = rangeRef.current;
      if (!host || !range) return false;
      const css = runStyleToCss(patch);
      if (!css) return false;

      const span = document.createElement("span");
      // setAttribute, not `style.cssText`, so what lands in innerHTML is exactly the string
      // lib/richText.ts promised is safe to sit inside a double-quoted attribute.
      span.setAttribute("style", css);

      try {
        span.appendChild(range.extractContents());
        range.insertNode(span);
      } catch {
        // A range can be left pointing at nodes that no longer exist — an edit landed under
        // it, or the element was regenerated. Failing quietly beats throwing under a caret.
        return false;
      }

      const next = document.createRange();
      next.selectNodeContents(span);
      rangeRef.current = next.cloneRange();

      // Focus first, then re-select: focusing afterwards would drop the range we just made.
      host.focus();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(next);

      setSelection({ length: span.textContent?.length ?? 0, style: styleOf(next, host) });
      return true;
    },
    [editingId]
  );

  return { selection, applyRunStyle };
}
