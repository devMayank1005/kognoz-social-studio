// The elements a person placed on the slide, drawn so they survive export.
//
// This layer renders INSIDE the node the exporter clones, which is the whole reason it
// exists as its own file: every rule below comes from lib/exportPipeline.ts, and breaking
// one produces a slide that looks right on screen and wrong in the downloaded PNG.
//
//   inline styles only   The exporter strips every <style> tag, so a class name renders
//                        perfectly in the browser and exports as an unstyled box.
//                        lib/exportSafety.test.ts fails the build on any className here.
//   no <input>           Every <input> is deleted unconditionally by the sanitiser. Text is
//                        a div, made contentEditable only while it is being typed into.
//   xmlns on every svg   The clone is re-parsed as XML in the XHTML namespace. An <svg>
//                        without its own namespace is parsed as XHTML and draws nothing.
//   no new void tags     Only img, br and input get XML-normalised. Anything else
//                        self-closing (<hr>, <wbr>) throws "XML: ..." and kills the export.
//
// Editor chrome — outlines, grips, toolbars — is NOT here. It lives in
// components/studio/CanvasEditor.tsx, mounted outside the exported node, so there is
// nothing to strip and no way for it to leak into a download.

import { sortByZ, type ShapeElement, type SlideElement, type TextElement } from "@/lib/slideElements";

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
}

function TextView({ el }: { el: TextElement }) {
  return (
    <div
      data-el-id={el.id}
      style={{
        position: "absolute",
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
        transformOrigin: "center center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: el.fontFamily,
        fontSize: el.fontSize,
        fontWeight: el.fontWeight,
        color: el.color,
        textAlign: el.align,
        lineHeight: el.lineHeight,
        // Newlines the person typed are content, not whitespace to collapse.
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        overflow: "hidden"
      }}
    >
      {el.text}
    </div>
  );
}

function ShapeView({ el }: { el: ShapeElement }) {
  const sw = Math.max(0, el.strokeWidth);
  // A stroke straddles the path, so an un-inset rect loses half its border to the box edge.
  const inset = sw / 2;
  const w = Math.max(0, el.w - sw);
  const h = Math.max(0, el.h - sw);
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
      </svg>
    </div>
  );
}

export default function ElementLayer({ elements, baseW, baseH, hideId }: ElementLayerProps) {
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
        pointerEvents: "none"
      }}
    >
      {sortByZ(elements).map((el) =>
        el.id === hideId ? null : el.kind === "text" ? (
          <TextView key={el.id} el={el} />
        ) : (
          <ShapeView key={el.id} el={el} />
        )
      )}
    </div>
  );
}
