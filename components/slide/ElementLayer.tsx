"use client";

// The elements a person placed on the slide, drawn so they survive export — and, on the
// preview only, edited in place with a real caret.
//
// This layer renders INSIDE the node the exporter clones, which is the whole reason it
// exists as its own file: every rule below comes from lib/exportPipeline.ts, and breaking
// one produces a slide that looks right on screen and wrong in the downloaded PNG.
//
//   inline styles only   The exporter strips every <style> tag, so a class name renders
//                        perfectly in the browser and exports as an unstyled box.
//                        lib/exportSafety.test.ts fails the build on any className here.
//   no <input>           Every <input> is deleted unconditionally by the sanitiser. Text is
//                        a div made contentEditable while it is being typed into.
//   xmlns on every svg   The clone is re-parsed as XML in the XHTML namespace. An <svg>
//                        without its own namespace is parsed as XHTML and draws nothing.
//   no new void tags     Only img, br and input get XML-normalised. Anything else
//                        self-closing (<hr>, <wbr>) throws "XML: ..." and kills the export.
//
// `editingId` is passed ONLY by the preview mount. The hidden export copies must never
// receive it: the exporter does not strip `contenteditable`, and a valueless one would be
// invalid XML. A test pins that the export tree carries none.
//
// Editor chrome — outlines, grips, toolbars — is NOT here. It lives in
// components/studio/CanvasEditor.tsx, mounted outside the exported node.

import { useEffect, useRef } from "react";
import {
  sanitiseHtml,
  sortByZ,
  textOfHtml,
  type ShapeElement,
  type SlideElement,
  type TextElement
} from "@/lib/slideElements";
import { normaliseSpans } from "@/lib/richText";
import { pathFor } from "@/lib/shapeLibrary";

export interface EditCommit {
  id: string;
  html: string;
  text: string;
  /** Rendered height in SLIDE pixels — see the note in TextView on why this is safe. */
  h: number;
}

export interface ElementLayerProps {
  elements: readonly SlideElement[];
  baseW: number;
  baseH: number;
  /**
   * Suppress one element while the editor draws it mid-drag.
   *
   * Only ever set on the on-screen preview. The export copies always render every element,
   * so a download taken during a drag is still complete.
   */
  hideId?: string | null;
  /** Preview only. The element that currently has a caret in it. */
  editingId?: string | null;
  /** Preview only. Fires when an inline edit ends — never per keystroke. */
  onEditCommit?: (commit: EditCommit) => void;
  /** Preview only. Escape: stop editing but stay selected. */
  onEditExit?: () => void;
}

/** Shared by the editing and the static render, so starting to type moves nothing. */
function textStyle(el: TextElement, editing: boolean): React.CSSProperties {
  return {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    // Block layout, not flex. A contentEditable flex container turns every line the person
    // types into a flex item and puts the caret in the wrong place — the same class of bug
    // components/Slide.tsx already documents for its own emphasis spans.
    display: "block",
    // Grows with the text while typing so the caret can never scroll out of sight; the
    // committed height is written back afterwards.
    height: editing ? "auto" : el.h,
    minHeight: editing ? el.h : undefined,
    // Never clipped: a box whose text has outgrown it should show the words, not eat them.
    overflow: "visible",
    transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
    transformOrigin: "center center",
    fontFamily: el.fontFamily,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    color: el.color,
    textAlign: el.align,
    lineHeight: el.lineHeight,
    // Newlines the person typed are content, not whitespace to collapse.
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word"
  };
}

function TextView({
  el,
  editing,
  onEditCommit,
  onEditExit
}: {
  el: TextElement;
  editing: boolean;
  onEditCommit?: (commit: EditCommit) => void;
  onEditExit?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Content is written once, imperatively, when editing begins — and React is not allowed to
  // own the children for as long as the caret is live. Re-rendering children under a caret
  // collapses the selection to the start on every keystroke, which is the single most common
  // way a contentEditable in React ends up unusable.
  //
  // The dependency list is deliberately just `editing`: re-running this because `el.html`
  // changed would undo the person's typing mid-sentence.
  useEffect(() => {
    if (!editing) return;
    const node = ref.current;
    if (!node) return;
    if (el.html) node.innerHTML = el.html;
    else node.textContent = el.text;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function commit() {
    const node = ref.current;
    if (!node || !onEditCommit) return;
    // Sanitise first, then tidy: dropping a disallowed tag can leave two spans adjacent that
    // were not before. Styling a range wraps it in a span, so without the tidy pass the
    // stored markup grows a layer every time somebody restyles the same words.
    const html = normaliseSpans(sanitiseHtml(node.innerHTML ?? ""));
    onEditCommit({
      id: el.id,
      html,
      text: textOfHtml(html),
      // offsetHeight is a LAYOUT measurement in the element's own pixels. The preview sits
      // under a CSS scale, which changes what getBoundingClientRect reports but not this —
      // so the number is already in slide pixels and needs no division.
      h: node.offsetHeight || el.h
    });
  }

  if (editing) {
    return (
      <div
        ref={ref}
        data-el-id={el.id}
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          // Escape leaves text editing but keeps the element selected. CanvasEditor's own
          // key handler bails on contentEditable before it reaches its Escape branch, so
          // this is the only place that can do it.
          e.preventDefault();
          e.stopPropagation();
          commit();
          onEditExit?.();
        }}
        style={{
          ...textStyle(el, true),
          pointerEvents: "auto",
          userSelect: "text",
          WebkitUserSelect: "text",
          cursor: "text",
          outline: "none"
        }}
      />
    );
  }

  // Markup when it came from the template — the gradient word and the per-line blocks are
  // part of what the element IS. Plain text for boxes somebody added by hand.
  return el.html ? (
    <div data-el-id={el.id} style={textStyle(el, false)} dangerouslySetInnerHTML={{ __html: el.html }} />
  ) : (
    <div data-el-id={el.id} style={textStyle(el, false)}>
      {el.text}
    </div>
  );
}

function ShapeView({ el }: { el: ShapeElement }) {
  const sw = Math.max(0, el.strokeWidth);
  // A stroke straddles the path, so an un-inset rect loses half its border to the box edge.
  const inset = sw / 2;
  const w = Math.max(0, el.w - sw);
  const boxH = Math.max(el.h, sw, 1);

  return (
    <div
      data-el-id={el.id}
      style={{
        position: "absolute",
        left: el.x,
        top: el.y,
        width: el.w,
        height: boxH,
        transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
        transformOrigin: "center center"
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={el.w}
        height={boxH}
        viewBox={`0 0 ${el.w} ${boxH}`}
        style={{ display: "block" }}
      >
        {el.kind === "rect" && (
          <rect
            x={inset}
            y={inset}
            width={w}
            height={Math.max(0, boxH - sw)}
            rx={el.radius}
            ry={el.radius}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={sw}
            opacity={el.opacity}
          />
        )}
        {el.kind === "ellipse" && (
          <ellipse
            cx={el.w / 2}
            cy={boxH / 2}
            rx={Math.max(0, w / 2)}
            ry={Math.max(0, (boxH - sw) / 2)}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={sw}
            opacity={el.opacity}
          />
        )}
        {el.kind === "line" && (
          <line
            x1={0}
            y1={boxH / 2}
            x2={el.w}
            y2={boxH / 2}
            stroke={el.stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            opacity={el.opacity}
          />
        )}
        {/* Everything the shape library adds — one branch, not thirty-four.
            The geometry lives in lib/shapeLibrary.ts as a function of the box, which is
            what keeps this file small; it is inside the export boundary, where it must stay
            className-free and every <svg> must carry xmlns or the export draws nothing.
            The path is built for a box inset by the stroke and then shifted back, exactly
            as the rect and ellipse branches above do, so a stroke straddles the outline
            instead of losing its outer half to the edge of the box. */}
        {el.kind !== "rect" && el.kind !== "ellipse" && el.kind !== "line" && (
          <path
            d={pathFor(el.kind, Math.max(0, el.w - sw), Math.max(0, boxH - sw))}
            transform={inset ? `translate(${inset},${inset})` : undefined}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
            opacity={el.opacity}
          />
        )}
      </svg>
    </div>
  );
}

export default function ElementLayer({
  elements,
  baseW,
  baseH,
  hideId,
  editingId,
  onEditCommit,
  onEditExit
}: ElementLayerProps) {
  if (!elements.length) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: baseW,
        height: baseH,
        // Stacking comes from DOM order below, not z-index: a z-index here would open a
        // stacking context that behaves differently inside foreignObject than on screen.
        // The layer stays inert; only the element being typed into takes pointer events.
        pointerEvents: "none"
      }}
    >
      {sortByZ(elements).map((el) =>
        el.id === hideId ? null : el.kind === "text" ? (
          <TextView
            key={el.id}
            el={el}
            editing={!!editingId && editingId === el.id}
            onEditCommit={onEditCommit}
            onEditExit={onEditExit}
          />
        ) : (
          <ShapeView key={el.id} el={el} />
        )
      )}
    </div>
  );
}
