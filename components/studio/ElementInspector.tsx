"use client";

// The contextual styling bar for whichever element is selected.
//
// Editor chrome: it renders outside the node the exporter clones, so it is free to use form
// controls the slide itself may never contain.
//
// It does NOT edit the words. That happens on the canvas, by double-clicking the text — see
// components/slide/ElementLayer.tsx. An earlier version had a textarea here and justified it
// by pointing at the exporter deleting every <input>; that reasoning never applied to a
// contentEditable div, and two places writing the same string is how caret bugs ship.
//
// Everything it writes is a patch onto one element; the geometry (x/y/w/h/rot) belongs to
// CanvasEditor and is deliberately not editable here.
//
// It is a router now, not a control panel: text goes to TypographyToolbar, shapes stay here.
// The typography vocabulary outgrew a file that also has to draw fill and stroke controls.
//
// The bar carries `data-keep-caret` because CanvasEditor's click-away listener would
// otherwise end the edit the instant you pressed anything here. See that file.

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import type { ShapeElement, SlideElement, TextElement } from "@/lib/slideElements";
import { sameFamily, type RunStyle } from "@/lib/richText";
import type { FontEntry } from "@/lib/fontRegistry";
import TypographyToolbar from "./TypographyToolbar";
import ColorPicker from "./ColorPicker";
import type { TextRangeSelection } from "./useTextRange";

export interface FontChoice {
  label: string;
  /** A full CSS stack, so the preview and the export resolve the same face. */
  value: string;
  /**
   * The weights this family is actually served at.
   *
   * Offering one it is not is a specific, shipped bug this codebase has already had: the
   * browser synthesises the missing weight on screen while the export embeds a real file at
   * a different weight, so the preview and the download disagree. See lib/fontRegistry.ts.
   */
  weights: number[];
}

export interface ElementInspectorProps {
  element: SlideElement;
  /** Every family this brand may use. The picker groups and searches them itself. */
  fonts: FontEntry[];
  /** Brand palette, offered as one of the picker's swatch rows. */
  swatches: string[];
  /** Colours already used on this deck, from `colorsUsed` in lib/slideElements.ts. */
  documentColors?: string[];
  /** The deck's saved palette, and the setter that persists it. */
  palette?: string[];
  onPaletteChange?: (next: string[]) => void;
  onChange: (patch: Partial<TextElement> & Partial<ShapeElement>) => void;
  /** The live character selection, when there is one. Null means "act on the element". */
  selection?: TextRangeSelection | null;
  /**
   * Style the selected characters. Returns false when the range turned out to be unusable,
   * which is this component's signal to fall back to patching the whole element rather than
   * appearing to do nothing.
   */
  onRunStyle?: (patch: RunStyle) => boolean;
  /**
   * Whether a caret is live in this element. Used only to announce that selecting characters
   * is possible — before this, the capability was mentioned nowhere until you had already
   * found it.
   */
  caretLive?: boolean;
  /** The deck's gradient, offered to the typography toolbar as the one-click option. */
  gradient: string;
  font: string;
  ink: string;
  line: string;
  inkMute: string;
}


export default function ElementInspector({
  element,
  fonts,
  swatches,
  documentColors = [],
  palette = [],
  onPaletteChange,
  onChange,
  selection,
  onRunStyle,
  caretLive,
  gradient,
  font,
  ink,
  line,
  inkMute
}: ElementInspectorProps) {
  const field: React.CSSProperties = {
    fontFamily: font,
    fontSize: 12.5,
    color: ink,
    border: `1px solid ${line}`,
    borderRadius: 8,
    padding: "6px 8px",
    background: "#fff"
  };
  const label: React.CSSProperties = {
    fontFamily: font,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: inkMute
  };
  const group: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };

  // The palette rows used to be a local Swatches component here and a near-identical one in
  // TypographyToolbar. Both now live inside ColorPicker, which also knows about recent and
  // document colours — things a bare swatch row could not offer.
  const colourProps = {
    brand: swatches,
    documentColors,
    palette,
    onPaletteChange,
    font,
    ink,
    line,
    inkMute
  };

  return (
    <div
      data-keep-caret
      style={{
        alignSelf: "stretch",
        display: "flex",
        alignItems: "flex-end",
        gap: 14,
        flexWrap: "wrap",
        padding: "10px 12px",
        marginBottom: 12,
        borderRadius: 12,
        border: `1px solid ${line}`,
        background: "#FBFCFD"
      }}
    >
      {element.kind === "text" ? (
        <TypographyToolbar
          element={element}
          fonts={fonts}
          swatches={swatches}
          documentColors={documentColors}
          palette={palette}
          onPaletteChange={onPaletteChange}
          selection={selection}
          onRunStyle={onRunStyle}
          caretLive={caretLive}
          // The toolbar only ever patches text fields; the shared handler is typed for both
          // kinds, and a Partial<TextElement> is not assignable to a Partial<ShapeElement>.
          onChange={onChange as (patch: Partial<TextElement>) => void}
          gradient={gradient}
          font={font}
          ink={ink}
          line={line}
          inkMute={inkMute}
        />
      ) : (
        <>
          <div style={group}>
            <span style={label}>Fill</span>
            <ColorPicker
              title="Shape fill"
              value={element.fill}
              onChange={(c) => onChange({ fill: c })}
              // Only the fill takes a gradient. A stroke could, but it would double the
              // <defs> surface for something nobody asked for — see the plan's exclusions.
              gradient={element.fillGradient ?? null}
              onGradientChange={(g) => onChange({ fillGradient: g ?? undefined })}
              onClear={() => onChange({ fill: "transparent", fillGradient: undefined })}
              {...colourProps}
            />
          </div>

          <div style={group}>
            <span style={label}>Border</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ColorPicker
                title="Border colour"
                value={element.stroke}
                onChange={(c) => onChange({ stroke: c })}
                onClear={() => onChange({ stroke: "transparent" })}
                {...colourProps}
              />
              <input
                type="number"
                min={0}
                max={80}
                value={element.strokeWidth}
                onChange={(e) => onChange({ strokeWidth: Math.max(0, Number(e.target.value) || 0) })}
                style={{ ...field, width: 66 }}
              />
            </div>
          </div>

          {element.kind === "rect" && (
            <div style={group}>
              <span style={label}>Corner</span>
              <input
                type="number"
                min={0}
                max={400}
                value={element.radius}
                onChange={(e) => onChange({ radius: Math.max(0, Number(e.target.value) || 0) })}
                style={{ ...field, width: 74 }}
              />
            </div>
          )}

          <div style={group}>
            <span style={label}>Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(element.opacity * 100)}
              onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
              style={{ width: 110 }}
            />
          </div>
        </>
      )}
    </div>
  );
}
