"use client";

// The node the exporter clones, and the one place template elements are hidden.
//
// Why the hiding is imperative rather than a prop threaded through the renderer: the 28
// marked slots live in ~17 separate return branches inside a 2000-line component, and
// giving each one a conditional style means 28 edits to the most load-bearing file in the
// app. Setting `visibility` from here is one place, it re-applies after every render, and
// it lands in the export because `cloneNode(true)` copies inline styles.
//
// `visibility: hidden` rather than `display: none` is deliberate: the element keeps its
// box, so hiding a headline does not make the paragraph below it jump up the slide.

import { useLayoutEffect, useRef, type ReactNode } from "react";

export interface SlideCanvasProps {
  /** The id lib/exportPipeline.ts looks up. Everything inside it is exported. */
  id: string;
  /** Template slots currently ejected onto the canvas. */
  hidden: readonly string[];
  width: number;
  height: number;
  children: ReactNode;
}

export default function SlideCanvas({ id, hidden, width, height, children }: SlideCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);

  // No dependency array: the slide re-renders for many reasons and may replace these
  // nodes entirely, so the mask is re-applied every time rather than tracked.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const node of Array.from(root.querySelectorAll<HTMLElement>("[data-slot]"))) {
      node.style.visibility = hidden.includes(node.dataset.slot ?? "") ? "hidden" : "";
    }
  });

  return (
    <div ref={ref} id={id} style={{ position: "relative", width, height, overflow: "hidden" }}>
      {children}
    </div>
  );
}
