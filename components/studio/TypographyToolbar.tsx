"use client";

// The typography toolbar.
//
// It was six controls inline in ElementInspector; it is now the whole vocabulary, which is
// too much to keep in the file that also draws shape controls.
//
// ONE RULE, EVERYWHERE: a control acts on the SELECTED CHARACTERS when there are any, and on
// the whole text box otherwise. That is why lib/slideElements.ts had to grow the same
// properties the run vocabulary carries — without a field on the element, the second half of
// that rule is a silent no-op.
//
// THREE CONTROLS BREAK THE RULE, on purpose. Superscript, subscript and gradient text are
// meaningless applied to an entire box, so they require a selection and say so when disabled.
// Align and line height go the other way: they are block properties and always act on the
// element, even mid-selection.
//
// Editor chrome — renders outside the node the exporter clones, so form controls are fine.

import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  Italic,
  MoreHorizontal,
  Strikethrough,
  Subscript,
  Superscript,
  Underline
} from "lucide-react";
import type { TextElement } from "@/lib/slideElements";
import {
  clearGradient,
  gradientRun,
  hasDecoration,
  isGradient,
  scriptRun,
  toggleDecoration,
  type RunStyle
} from "@/lib/richText";
import { facesFor, familyOf, type FontEntry } from "@/lib/fontRegistry";
import type { TextRangeSelection } from "./useTextRange";
import FontPicker from "./FontPicker";
import ColorPicker from "./ColorPicker";
import {
  defaultGradient,
  gradientCss,
  parseGradientCss,
  type Gradient
} from "@/lib/gradient";

export interface TypographyToolbarProps {
  element: TextElement;
  fonts: FontEntry[];
  swatches: string[];
  documentColors?: string[];
  palette?: string[];
  onPaletteChange?: (next: string[]) => void;
  selection?: TextRangeSelection | null;
  onRunStyle?: (patch: RunStyle) => boolean;
  /** A caret is live in this element, so telling people about ranges is useful. */
  caretLive?: boolean;
  onChange: (patch: Partial<TextElement>) => void;
  /** The deck's gradient, offered as the one-click option. */
  gradient: string;
  font: string;
  ink: string;
  line: string;
  inkMute: string;
}

export default function TypographyToolbar({
  element,
  fonts,
  swatches,
  documentColors = [],
  palette = [],
  onPaletteChange,
  selection,
  onRunStyle,
  caretLive,
  onChange,
  gradient,
  font,
  ink,
  line,
  inkMute
}: TypographyToolbarProps) {
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // What the controls SHOW: the selection's resolved style when there is one, the element's
  // own otherwise. Without this the colour swatch sits on the box's colour while you are
  // looking at a differently-coloured run you just selected.
  const run = selection?.style;
  const family = run?.fontFamily ?? element.fontFamily;
  const faces = facesFor(familyOf(family));
  const size = run?.fontSize ?? element.fontSize;
  const weight = run?.fontWeight ?? element.fontWeight;
  const colour = run?.color ?? element.color;
  const italic = (run?.fontStyle ?? element.fontStyle) === "italic";
  const highlight = run?.backgroundColor ?? element.backgroundColor ?? "";
  const decoration = { textDecorationLine: run?.textDecorationLine ?? element.textDecorationLine };
  const transform = run?.textTransform ?? element.textTransform ?? "none";
  const tracking = run?.letterSpacing ?? element.letterSpacing ?? 0;
  const alpha = run?.opacity ?? element.opacity ?? 1;
  const script = run?.verticalAlign ?? "baseline";
  const stroked = Boolean(run?.webkitTextStroke ?? element.webkitTextStroke);
  const shadowed = Boolean(run?.textShadow ?? element.textShadow);
  const rtl = (run?.direction ?? element.direction) === "rtl";
  const canItalic = faces.italics.length > 0;
  const hasRange = Boolean(selection && onRunStyle);

  // The gradient currently on the selected run, read back so the editor opens on what is
  // there. This is only possible since `styleOf` started reporting `backgroundImage` — until
  // then `isGradient(run)` was always false, the toggle showed un-pressed over gradient text,
  // and `clearGradient` could not be reached at all.
  const runGradient = isGradient(run ?? {}) ? parseGradientCss(run?.backgroundImage ?? "") : null;

  /**
   * Apply or clear a gradient on the selected characters.
   *
   * Range-only, deliberately: `TextElement` carries no `backgroundImage`, so a gradient on a
   * whole box would patch a field the renderer never reads and deckStore drops on reload.
   * lib/slideElements.ts says as much where those fields are declared.
   */
  const setRunGradient = (next: Gradient | null) => {
    if (!hasRange) return;
    styleRange(next ? gradientRun(gradientCss(next)) : clearGradient(element.color));
  };

  /** Selection if there is one and it is still usable, whole element otherwise. */
  const styleText = (patch: RunStyle) => {
    if (selection && onRunStyle && onRunStyle(patch)) return;
    onChange(patch as Partial<TextElement>);
  };

  /** For the three that only mean something on a range. */
  const styleRange = (patch: RunStyle) => {
    if (hasRange) onRunStyle!(patch);
  };

  // ⌘B / ⌘I / ⌘U / ⌘⇧X, only while a caret is live in this element.
  useEffect(() => {
    if (!caretLive) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        // Toggle to the family's real bold rather than a hardcoded 700 — a family that does
        // not serve 700 would otherwise get a synthesised one on screen and a different
        // weight in the export.
        const bold = faces.weights.includes(700) ? 700 : faces.weights[faces.weights.length - 1];
        const base = faces.weights.includes(400) ? 400 : faces.weights[0];
        styleText({ fontWeight: weight >= bold ? base : bold });
      } else if (key === "i" && canItalic) {
        e.preventDefault();
        styleText({ fontStyle: italic ? "normal" : "italic" });
      } else if (key === "u") {
        e.preventDefault();
        styleText({ textDecorationLine: toggleDecoration(decoration, "underline") });
      } else if (e.shiftKey && key === "x") {
        e.preventDefault();
        styleText({ textDecorationLine: toggleDecoration(decoration, "line-through") });
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  useEffect(() => {
    if (!more) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && moreRef.current?.contains(e.target)) return;
      setMore(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [more]);

  /* ----------------------------------------------------------------------------- */

  const label: React.CSSProperties = {
    fontFamily: font,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: inkMute,
    whiteSpace: "nowrap"
  };
  const group: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3 };
  const field: React.CSSProperties = {
    fontFamily: font,
    fontSize: 12.5,
    color: ink,
    border: `1px solid ${line}`,
    borderRadius: 8,
    padding: "6px 8px",
    background: "#fff"
  };

  function Toggle({
    on,
    onClick,
    title,
    disabled,
    children
  }: {
    on: boolean;
    onClick: () => void;
    title: string;
    disabled?: boolean;
    children: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={on}
        disabled={disabled}
        onClick={onClick}
        style={{
          width: 30,
          height: 30,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.35 : 1,
          border: `1px solid ${on ? ink : line}`,
          background: on ? ink : "#fff",
          color: on ? "#fff" : ink
        }}
      >
        {children}
      </button>
    );
  }

  // The brand swatch row used to be a local component here and a near-identical one in
  // ElementInspector. Both are now rows inside ColorPicker, which also offers recent and
  // document colours — things a bare swatch row had no way to show.
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Row one — the controls somebody reaches for on every text box. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={group}>
          <span style={label}>Font</span>
          <FontPicker
            value={family}
            fonts={fonts}
            onPick={(stack) => styleText({ fontFamily: stack })}
            font={font}
            ink={ink}
            line={line}
            inkMute={inkMute}
          />
        </div>

        <div style={group}>
          <span style={label}>Weight</span>
          <select
            value={weight}
            onChange={(e) => styleText({ fontWeight: Number(e.target.value) })}
            style={{ ...field, width: 74 }}
            title="Font weight"
          >
            {[...new Set([...faces.weights, weight])]
              .sort((a, b) => a - b)
              .map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
          </select>
        </div>

        <div style={group}>
          <span style={label}>Style</span>
          <div style={{ display: "flex", gap: 3 }}>
            <Toggle
              on={weight >= (faces.weights.includes(700) ? 700 : faces.weights[faces.weights.length - 1])}
              title="Bold  ⌘B"
              onClick={() => {
                const bold = faces.weights.includes(700) ? 700 : faces.weights[faces.weights.length - 1];
                const base = faces.weights.includes(400) ? 400 : faces.weights[0];
                styleText({ fontWeight: weight >= bold ? base : bold });
              }}
            >
              <Bold size={14} />
            </Toggle>
            <Toggle
              on={italic}
              disabled={!canItalic}
              // Disabled rather than allowed: a family with no italic is obliqued by the
              // browser on screen and rendered upright in the export.
              title={canItalic ? "Italic  ⌘I" : `${familyOf(family) || "This font"} has no italic`}
              onClick={() => styleText({ fontStyle: italic ? "normal" : "italic" })}
            >
              <Italic size={14} />
            </Toggle>
            <Toggle
              on={hasDecoration(decoration, "underline")}
              title="Underline  ⌘U"
              onClick={() => styleText({ textDecorationLine: toggleDecoration(decoration, "underline") })}
            >
              <Underline size={14} />
            </Toggle>
            <Toggle
              on={hasDecoration(decoration, "line-through")}
              title="Strikethrough  ⌘⇧X"
              onClick={() => styleText({ textDecorationLine: toggleDecoration(decoration, "line-through") })}
            >
              <Strikethrough size={14} />
            </Toggle>
          </div>
        </div>

        <div style={group}>
          <span style={label}>Size</span>
          <input
            type="number"
            min={4}
            max={400}
            value={Math.round(size)}
            onChange={(e) => styleText({ fontSize: Math.max(4, Number(e.target.value) || 4) })}
            style={{ ...field, width: 66 }}
            title="Font size"
          />
        </div>

        <div style={group}>
          <span style={label}>Colour</span>
          <ColorPicker
            title="Text colour"
            value={colour}
            onChange={(c) => styleText({ color: c })}
            // A gradient needs characters to clip to, so it is offered only over a range.
            gradient={runGradient}
            onGradientChange={hasRange ? setRunGradient : undefined}
            {...colourProps}
          />
        </div>

        <div style={group}>
          <span style={label}>Highlight</span>
          <ColorPicker
            title="Highlight behind the text"
            value={highlight || "transparent"}
            onChange={(c) => styleText({ backgroundColor: c })}
            onClear={() => styleText({ backgroundColor: "transparent" })}
            clearLabel="None"
            {...colourProps}
          />
        </div>

        <div style={group}>
          <span style={label}>Align</span>
          <div style={{ display: "flex", gap: 3 }}>
            {([
              ["left", AlignLeft, "Align left"],
              ["center", AlignCenter, "Align centre"],
              ["right", AlignRight, "Align right"]
            ] as const).map(([a, Icon, tip]) => (
              <Toggle
                key={a}
                on={element.align === a}
                // Always the element: text-align is a block property and cannot mean
                // anything applied to a range of characters.
                onClick={() => onChange({ align: a })}
                title={tip}
              >
                <Icon size={14} />
              </Toggle>
            ))}
          </div>
        </div>
      </div>

      {/* Row two — the finer adjustments, plus everything else behind More. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={group}>
          <span style={label}>Line height</span>
          <input
            type="number"
            step={0.05}
            min={0.6}
            max={3}
            value={element.lineHeight}
            onChange={(e) => onChange({ lineHeight: Math.max(0.6, Number(e.target.value) || 1.2) })}
            style={{ ...field, width: 66 }}
            title="Line height (whole box)"
          />
        </div>

        <div style={group}>
          <span style={label}>Tracking</span>
          <input
            type="number"
            step={0.5}
            value={tracking}
            onChange={(e) => styleText({ letterSpacing: Number(e.target.value) || 0 })}
            style={{ ...field, width: 66 }}
            title="Letter spacing"
          />
        </div>

        <div style={group}>
          <span style={label}>Case</span>
          <div style={{ display: "flex", gap: 3 }}>
            {([
              ["none", CaseSensitive, "As typed"],
              ["uppercase", CaseUpper, "UPPERCASE"],
              ["lowercase", CaseLower, "lowercase"]
            ] as const).map(([value, Icon, tip]) => (
              <Toggle
                key={value}
                on={transform === value}
                onClick={() => styleText({ textTransform: value })}
                title={tip}
              >
                <Icon size={14} />
              </Toggle>
            ))}
            <Toggle
              on={transform === "capitalize"}
              onClick={() => styleText({ textTransform: "capitalize" })}
              title="Title Case"
            >
              <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700 }}>Tt</span>
            </Toggle>
          </div>
        </div>

        <div style={{ ...group, position: "relative" }} ref={moreRef}>
          <span style={label}>More</span>
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            title="More typography"
            style={{ ...field, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <MoreHorizontal size={14} />
            <span style={{ fontSize: 10 }}>▾</span>
          </button>

          {more && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: 0,
                zIndex: 40,
                width: 250,
                background: "#fff",
                border: `1px solid ${line}`,
                borderRadius: 12,
                boxShadow: "0 12px 32px rgba(11,31,51,0.14)",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 12
              }}
            >
              <div style={group}>
                <span style={label}>Decoration & script</span>
                <div style={{ display: "flex", gap: 3 }}>
                  <Toggle
                    on={hasDecoration(decoration, "overline")}
                    onClick={() => styleText({ textDecorationLine: toggleDecoration(decoration, "overline") })}
                    title="Overline"
                  >
                    <span style={{ fontFamily: font, fontSize: 12, textDecoration: "overline" }}>A</span>
                  </Toggle>
                  <Toggle
                    on={script === "super"}
                    disabled={!hasRange}
                    title={hasRange ? "Superscript" : "Select characters first"}
                    onClick={() => styleRange(scriptRun(script === "super" ? "baseline" : "super", size))}
                  >
                    <Superscript size={14} />
                  </Toggle>
                  <Toggle
                    on={script === "sub"}
                    disabled={!hasRange}
                    title={hasRange ? "Subscript" : "Select characters first"}
                    onClick={() => styleRange(scriptRun(script === "sub" ? "baseline" : "sub", size))}
                  >
                    <Subscript size={14} />
                  </Toggle>
                </div>
              </div>

              <div style={group}>
                <span style={label}>Effects</span>
                <div style={{ display: "flex", gap: 3 }}>
                  <Toggle
                    on={stroked}
                    title="Outline"
                    onClick={() => styleText({ webkitTextStroke: stroked ? "0px transparent" : `2px ${ink}` })}
                  >
                    <span style={{ fontFamily: font, fontSize: 12, fontWeight: 800, WebkitTextStroke: `0.6px ${ink}` }}>O</span>
                  </Toggle>
                  <Toggle
                    on={shadowed}
                    title="Shadow"
                    onClick={() => styleText({ textShadow: shadowed ? "none" : "0 2px 6px rgba(0,0,0,0.35)" })}
                  >
                    <span style={{ fontFamily: font, fontSize: 12, fontWeight: 800, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>S</span>
                  </Toggle>
                  <Toggle
                    on={isGradient(run ?? {})}
                    disabled={!hasRange}
                    title={
                      !hasRange
                        ? "Select characters first"
                        : isGradient(run ?? {})
                          ? "Remove the gradient"
                          : "Gradient text — edit it in the colour picker"
                    }
                    onClick={() =>
                      setRunGradient(
                        isGradient(run ?? {}) ? null : (parseGradientCss(gradient) ?? defaultGradient(element.color, "#ffffff"))
                      )
                    }
                  >
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: gradient, display: "block" }} />
                  </Toggle>
                  <Toggle on={rtl} title="Right to left" onClick={() => styleText({ direction: rtl ? "ltr" : "rtl" })}>
                    <span style={{ fontFamily: font, fontSize: 10, fontWeight: 800 }}>RTL</span>
                  </Toggle>
                </div>
              </div>

              <div style={group}>
                <span style={label}>Opacity · {Math.round(alpha * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(alpha * 100)}
                  onChange={(e) => styleText({ opacity: Number(e.target.value) / 100 })}
                  style={{ width: "100%" }}
                  title="Text opacity"
                />
              </div>
            </div>
          )}
        </div>

        {(selection || caretLive) && (
          <div style={{ ...group, marginLeft: "auto" }}>
            <span style={label}>Editing</span>
            <span
              style={{
                fontFamily: font,
                fontSize: 12.5,
                color: selection ? ink : inkMute,
                padding: "6px 0",
                whiteSpace: "nowrap"
              }}
            >
              {selection
                ? `${selection.length} character${selection.length === 1 ? "" : "s"}`
                : "Select words to style just those"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
