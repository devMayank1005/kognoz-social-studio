"use client";

// The contextual styling bar for whichever element is selected.
//
// Editor chrome: it renders outside the node the exporter clones, so it is free to use
// form controls the slide itself may never contain — lib/exportPipeline.ts deletes every
// <input> it finds inside a slide, which is why text content is edited here in a textarea
// rather than typed directly onto the canvas.
//
// Everything it writes is a patch onto one element; the geometry (x/y/w/h/rot) belongs to
// CanvasEditor and is deliberately not editable here.

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import type { ShapeElement, SlideElement, TextElement } from "@/lib/slideElements";

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

  // Only the weights this family really has. A weight the deck already carries is kept in
  // the list even if the family no longer offers it, so changing the colour cannot silently
  // restyle the text.
  const chosen = element.kind === "text" ? fonts.find((f) => f.value === element.fontFamily) : undefined;
  const weights =
    element.kind === "text"
      ? [...new Set([...(chosen?.weights ?? [400, 700]), element.fontWeight])].sort((a, b) => a - b)
      : [];

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
          <div style={{ ...group, flex: "1 1 240px", minWidth: 200 }}>
            <span style={label}>Text</span>
            <textarea
              value={element.text}
              onChange={(e) => onChange({ text: e.target.value })}
              rows={2}
              style={{ ...field, resize: "vertical", lineHeight: 1.35 }}
            />
          </div>

          <div style={group}>
            <span style={label}>Font</span>
            <select value={element.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })} style={field}>
              {/* A family the deck already uses but the picker does not offer — an older
                  deck, or a font since removed — would otherwise vanish from the control
                  and be silently rewritten on the next change. */}
              {!fonts.some((f) => f.value === element.fontFamily) && (
                <option value={element.fontFamily}>{element.fontFamily.split(",")[0].replace(/['"]/g, "")}</option>
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
              value={element.fontSize}
              onChange={(e) => onChange({ fontSize: Math.max(4, Number(e.target.value) || 4) })}
              style={{ ...field, width: 74 }}
            />
          </div>

          <div style={group}>
            <span style={label}>Weight</span>
            <select
              value={element.fontWeight}
              onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
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
                value={element.color}
                onChange={(e) => onChange({ color: e.target.value })}
                style={{ width: 34, height: 30, padding: 0, border: `1px solid ${line}`, borderRadius: 8, background: "#fff" }}
              />
              <Swatches onPick={(c) => onChange({ color: c })} />
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
