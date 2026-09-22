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
import { rgbToHex, runStyleToCss, type RunStyle } from "@/lib/richText";

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

function styleOf(range: Range): RunStyle {
  const node = range.startContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) return {};
  const cs = window.getComputedStyle(el);
  const size = Number.parseFloat(cs.fontSize);
  const weight = Number.parseInt(cs.fontWeight, 10);
  return {
    fontFamily: cs.fontFamily || undefined,
    fontSize: Number.isFinite(size) ? Math.round(size) : undefined,
    fontWeight: Number.isFinite(weight) ? weight : undefined,
    // Computed colour is always an rgb() string; the swatch input only speaks hex.
    color: rgbToHex(cs.color)
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
      setSelection({ length: range.toString().length, style: styleOf(range) });
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

      setSelection({ length: span.textContent?.length ?? 0, style: styleOf(next) });
      return true;
    },
    [editingId]
  );

  return { selection, applyRunStyle };
}
