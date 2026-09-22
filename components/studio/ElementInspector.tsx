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
// ONE CONTROL, TWO TARGETS. When characters are selected inside a live caret, Font / Size /
// Weight / Colour act on THAT RANGE instead of the whole element — same controls, same
// place, and a count beside them saying how many characters are in play. Align is the
// exception: `text-align` is a block property, so it stays on the element even mid-selection.
//
// The bar carries `data-keep-caret` because CanvasEditor's click-away listener would
// otherwise end the edit the instant you pressed anything here. See that file.

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import type { ShapeElement, SlideElement, TextElement } from "@/lib/slideElements";
import { sameFamily, type RunStyle } from "@/lib/richText";
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
  fonts: FontChoice[];
  /** Brand palette, offered as swatches beside the free colour picker. */
  swatches: string[];
  onChange: (patch: Partial<TextElement> & Partial<ShapeElement>) => void;
  /** The live character selection, when there is one. Null means "act on the element". */
  selection?: TextRangeSelection | null;
  /**
   * Style the selected characters. Returns false when the range turned out to be unusable,
   * which is this component's signal to fall back to patching the whole element rather than
   * appearing to do nothing.
   */
  onRunStyle?: (patch: RunStyle) => boolean;
  font: string;
  ink: string;
  line: string;
  inkMute: string;
}


export default function ElementInspector({
  element,
  fonts,
  swatches,
  onChange,
  selection,
  onRunStyle,
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

  const text = element.kind === "text" ? element : null;
  // What the controls should be SHOWING: the selection's resolved style when there is one,
  // the element's own otherwise. Without this the colour swatch would sit on the element's
  // colour while you are looking at a differently-coloured run you selected.
  const run = text ? selection?.style : undefined;

  // The computed family comes back re-serialised by the browser, so it is matched against
  // the picker by family name rather than by string equality (lib/richText.ts).
  const activeFamily = (run && fonts.find((f) => sameFamily(f.value, run.fontFamily))?.value) || text?.fontFamily || "";
  const activeSize = run?.fontSize ?? text?.fontSize ?? 16;
  const activeWeight = run?.fontWeight ?? text?.fontWeight ?? 400;
  const activeColor = run?.color ?? text?.color ?? "#000000";

  // Only the weights this family really has. A weight the deck already carries is kept in
  // the list even if the family no longer offers it, so changing the colour cannot silently
  // restyle the text. This guard matters MORE per-range, not less: a run set to a weight the
  // family does not serve is synthesised on screen and embedded for real in the export.
  const chosen = fonts.find((f) => f.value === activeFamily);
  const weights = text ? [...new Set([...(chosen?.weights ?? [400, 700]), activeWeight])].sort((a, b) => a - b) : [];

  /** Range if there is one and it is still usable, whole element otherwise. */
  const styleText = (patch: RunStyle) => {
    if (selection && onRunStyle && onRunStyle(patch)) return;
    onChange(patch);
  };

  const Swatches = ({ onPick }: { onPick: (c: string) => void }) => (
    <div style={{ display: "flex", gap: 3 }}>
      {swatches.map((c) => (
        <div
          key={c}
          onClick={() => onPick(c)}
          title={c}
          style={{ width: 18, height: 18, borderRadius: 4, background: c, border: `1px solid ${line}`, cursor: "pointer" }}
        />
      ))}
    </div>
  );

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
        <>
          <div style={group}>
            <span style={label}>Font</span>
            <select value={activeFamily} onChange={(e) => styleText({ fontFamily: e.target.value })} style={field}>
              {/* A family the deck already uses but the picker does not offer — an older
                  deck, or a font since removed — would otherwise vanish from the control
                  and be silently rewritten on the next change. */}
              {!fonts.some((f) => f.value === activeFamily) && (
                <option value={activeFamily}>{activeFamily.split(",")[0].replace(/['"]/g, "")}</option>
              )}
              {fonts.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div style={group}>
            <span style={label}>Size</span>
            <input
              type="number"
              min={4}
              max={400}
              value={activeSize}
              onChange={(e) => styleText({ fontSize: Math.max(4, Number(e.target.value) || 4) })}
              style={{ ...field, width: 74 }}
            />
          </div>

          <div style={group}>
            <span style={label}>Weight</span>
            <select
              value={activeWeight}
              onChange={(e) => styleText({ fontWeight: Number(e.target.value) })}
              style={{ ...field, width: 78 }}
            >
              {weights.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          <div style={group}>
            <span style={label}>Colour</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="color"
                value={activeColor}
                onChange={(e) => styleText({ color: e.target.value })}
                style={{ width: 34, height: 30, padding: 0, border: `1px solid ${line}`, borderRadius: 8, background: "#fff" }}
              />
              <Swatches onPick={(c) => styleText({ color: c })} />
            </div>
          </div>

          <div style={group}>
            <span style={label}>Align</span>
            <div style={{ display: "flex", gap: 2 }}>
              {([
                ["left", AlignLeft],
                ["center", AlignCenter],
                ["right", AlignRight]
              ] as const).map(([a, Icon]) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => onChange({ align: a })}
                  aria-label={`Align ${a}`}
                  style={{
                    width: 32,
                    height: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: `1px solid ${element.align === a ? ink : line}`,
                    background: element.align === a ? ink : "#fff",
                    color: element.align === a ? "#fff" : ink
                  }}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>

          {selection && (
            <div style={{ ...group, marginLeft: "auto" }}>
              <span style={label}>Editing</span>
              <span style={{ fontFamily: font, fontSize: 12.5, color: ink, padding: "6px 0", whiteSpace: "nowrap" }}>
                {selection.length} character{selection.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={group}>
            <span style={label}>Fill</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="color"
                value={element.fill === "transparent" ? "#ffffff" : element.fill}
                onChange={(e) => onChange({ fill: e.target.value })}
                style={{ width: 34, height: 30, padding: 0, border: `1px solid ${line}`, borderRadius: 8, background: "#fff" }}
              />
              <Swatches onPick={(c) => onChange({ fill: c })} />
              <button
                type="button"
                onClick={() => onChange({ fill: "transparent" })}
                style={{ ...field, cursor: "pointer", padding: "6px 9px" }}
              >
                None
              </button>
            </div>
          </div>

          <div style={group}>
            <span style={label}>Border</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="color"
                value={element.stroke === "transparent" ? "#000000" : element.stroke}
                onChange={(e) => onChange({ stroke: e.target.value })}
                style={{ width: 34, height: 30, padding: 0, border: `1px solid ${line}`, borderRadius: 8, background: "#fff" }}
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
