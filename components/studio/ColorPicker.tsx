"use client";

// The colour picker: one control replacing four `<input type="color">`.
//
// WHAT WAS THERE BEFORE, AND WHY IT HAD TO GO. Each of the four sites guarded its value with
// `/^#[0-9a-f]{6}$/i` and fell back to black or to a hardcoded yellow. Every colour that was
// not six-digit hex — every `rgba()`, every computed `rgb()` off a live selection, every
// `transparent` — displayed as black while being something else. The control lied about what
// was on the canvas, and there was no way to type a value, no alpha, and no memory of the
// colour used thirty seconds ago.
//
// Editor chrome: this renders outside the node lib/exportPipeline.ts clones, so form controls
// and modern CSS are fine here. Inline styles rather than Tailwind, matching FontPicker and
// the rest of components/studio.
//
// IT MUST NOT PORTAL. The picker is mounted inside the bar carrying `data-keep-caret`
// (components/studio/ElementInspector.tsx), which is what stops CanvasEditor's capture-phase
// listener destroying the text selection the moment you reach for a control. A portal would
// render outside that subtree and every range recolour would silently become a whole-element
// one. components/studio/canvasCaret.test.tsx pins the exemption.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pipette, Plus, X } from "lucide-react";
import {
  alphaOf,
  hslToRgb,
  parseColor,
  rgbToHsl,
  toHex,
  toHslString,
  toRgbString,
  withAlpha
} from "@/lib/color";
import {
  MAX_STOPS,
  MIN_STOPS,
  defaultGradient,
  gradientCss,
  normaliseGradient,
  type Gradient
} from "@/lib/gradient";
import { MAX_RECENT, addRecent, loadRecent, saveRecent } from "@/lib/recentColors";

type Format = "hex" | "rgb" | "hsl";

/** Alpha is shown over this so 50% reads as translucent rather than as a lighter colour. */
const CHECKER: React.CSSProperties = {
  backgroundImage: "conic-gradient(#d4dde3 25%, #fff 0 50%, #d4dde3 0 75%, #fff 0)",
  backgroundSize: "8px 8px"
};

const HUES = "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)";

export interface ColorPickerProps {
  /** The current solid colour. Anything lib/color.ts can read. */
  value: string;
  onChange: (css: string) => void;
  /** Shown on the trigger, and used as the control's accessible name. */
  title: string;
  /** Brand palette, already resolved by the caller — this file may not name a brand hex. */
  brand?: readonly string[];
  /** Colours already on the canvas, from `colorsUsed` in lib/slideElements.ts. */
  documentColors?: readonly string[];
  /** The deck's saved palette, and the setter that persists it. */
  palette?: readonly string[];
  onPaletteChange?: (next: string[]) => void;
  /** A gradient on this target, when the caller supports one. */
  gradient?: Gradient | null;
  onGradientChange?: (next: Gradient | null) => void;
  /** Offered when the target can be cleared entirely (a fill, a highlight). */
  onClear?: () => void;
  clearLabel?: string;
  disabled?: boolean;
  /** Theme, drilled down from Studio exactly as FontPicker takes it. */
  font: string;
  ink: string;
  line: string;
  inkMute: string;
}

export default function ColorPicker({
  value,
  onChange,
  title,
  brand = [],
  documentColors = [],
  palette = [],
  onPaletteChange,
  gradient = null,
  onGradientChange,
  onClear,
  clearLabel = "None",
  disabled = false,
  font,
  ink,
  line,
  inkMute
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("hex");
  const [typed, setTyped] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [tab, setTab] = useState<"solid" | "gradient">(gradient ? "gradient" : "solid");
  const [stopIndex, setStopIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const gradientMode = tab === "gradient" && gradient !== null && onGradientChange !== undefined;

  // The colour the sliders are editing: the swatch itself, or the selected gradient stop.
  const active = gradientMode ? (gradient.stops[stopIndex]?.color ?? value) : value;
  const rgba = parseColor(active) ?? { r: 0, g: 0, b: 0, a: 1 };
  const hsl = rgbToHsl(rgba);

  const close = useCallback(() => {
    setOpen(false);
    setTyped(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    setRecent(loadRecent());
  }, [open]);

  // Dismiss on a press elsewhere and on Escape — the same pair FontPicker and ShapePicker
  // use, in the capture phase, with Escape stopped so it does not also close the panel this
  // picker is sitting inside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close]);

  /** Commit a colour to whichever target is being edited, and remember it. */
  const commit = useCallback(
    (css: string, remember = false) => {
      if (gradientMode) {
        const stops = gradient.stops.map((s, i) => (i === stopIndex ? { ...s, color: css } : s));
        onGradientChange!({ ...gradient, stops });
      } else {
        onChange(css);
      }
      if (remember) {
        const next = addRecent(loadRecent(), css);
        saveRecent(next);
        setRecent(next);
      }
    },
    [gradientMode, gradient, stopIndex, onGradientChange, onChange]
  );

  const setHsl = (h: number, s: number, l: number, a = rgba.a) => {
    const next = hslToRgb(h, s, l, a);
    commit(a >= 1 ? toHex(next) : toRgbString(next));
    setTyped(null);
  };

  // --- the saturation / lightness plane -------------------------------------------------
  //
  // HSL rather than the more familiar HSV square, so there is exactly one colour space in
  // this feature. lib/color.ts is HSL and tested; adding HSV for the sake of a square would
  // mean a second conversion nobody has covered. x is saturation, y is lightness.
  const pickFromSquare = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = squareRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    const x = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
    const y = Math.max(0, Math.min(1, (e.clientY - box.top) / box.height));
    setHsl(hsl.h, Math.round(x * 100), Math.round((1 - y) * 100));
  };

  const text = typed ?? (format === "hex" ? toHex(rgba) : format === "rgb" ? toRgbString(rgba) : toHslString(rgba));

  const applyTyped = (raw: string) => {
    setTyped(raw);
    const parsed = parseColor(raw.trim());
    // Only commit something readable. Refusing to act beats recolouring to black on the way
    // through a half-typed value — which is what the old six-digit guard did on every keystroke.
    if (parsed) commit(raw.trim());
  };

  const eyedropper = async () => {
    const Ctor = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } })
      .EyeDropper;
    if (!Ctor) return;
    try {
      const result = await new Ctor().open();
      if (result?.sRGBHex) commit(result.sRGBHex, true);
    } catch {
      // The person pressed Escape out of the dropper. Not an error.
    }
  };

  // Feature-detected rather than sniffed, and hidden rather than disabled: EyeDropper is
  // Chromium-only, and a permanently dead button is worse than no button.
  const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

  // --- gradient stops --------------------------------------------------------------------
  const setGradient = (next: Gradient) => onGradientChange?.(normaliseGradient(next));

  const moveStop = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    const box = railRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || !gradient) return;
    const at = Math.round(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * 100);
    // Edited in place rather than through normaliseGradient, which sorts: re-sorting mid-drag
    // would renumber the stops under the finger and the marker would jump to another one.
    onGradientChange?.({ ...gradient, stops: gradient.stops.map((s, i) => (i === index ? { ...s, at } : s)) });
  };

  const addStop = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = railRef.current?.getBoundingClientRect();
    if (!box || !gradient || gradient.stops.length >= MAX_STOPS) return;
    const at = Math.round(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * 100);
    const stops = [...gradient.stops, { color: toHex(rgba), at }].sort((a, b) => a.at - b.at);
    setStopIndex(stops.findIndex((s) => s.at === at));
    setGradient({ ...gradient, stops });
  };

  const removeStop = (index: number) => {
    if (!gradient || gradient.stops.length <= MIN_STOPS) return;
    setGradient({ ...gradient, stops: gradient.stops.filter((_, i) => i !== index) });
    setStopIndex(0);
  };

  // --- styling -----------------------------------------------------------------------------
  const swatchBox: React.CSSProperties = {
    width: 32,
    height: 30,
    borderRadius: 8,
    border: `1px solid ${line}`,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    padding: 0,
    overflow: "hidden",
    position: "relative",
    ...CHECKER
  };

  const field: React.CSSProperties = {
    fontFamily: font,
    fontSize: 12,
    padding: "6px 8px",
    border: `1px solid ${line}`,
    borderRadius: 8,
    color: ink,
    outline: "none",
    background: "#fff"
  };

  const tiny = (on: boolean): React.CSSProperties => ({
    fontFamily: font,
    fontSize: 10,
    fontWeight: 700,
    padding: "4px 7px",
    borderRadius: 6,
    cursor: "pointer",
    border: `1px solid ${on ? ink : line}`,
    background: on ? ink : "#fff",
    color: on ? "#fff" : inkMute
  });

  const sectionLabel: React.CSSProperties = {
    fontFamily: font,
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: inkMute,
    margin: "10px 0 5px"
  };

  const preview = gradientMode ? gradientCss(gradient) : active;

  const Swatches = ({ colours, onPick, removable }: {
    colours: readonly string[];
    onPick: (c: string) => void;
    removable?: (c: string) => void;
  }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {colours.map((c, i) => (
        <div key={`${c}-${i}`} style={{ position: "relative" }}>
          <div
            role="button"
            tabIndex={0}
            title={c}
            aria-label={c}
            onClick={() => onPick(c)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick(c);
              }
            }}
            style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${line}`, cursor: "pointer", ...CHECKER }}
          >
            <div style={{ width: "100%", height: "100%", background: c, borderRadius: 3 }} />
          </div>
          {removable && (
            <button
              type="button"
              title={`Remove ${c}`}
              aria-label={`Remove ${c}`}
              onClick={() => removable(c)}
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                width: 12,
                height: 12,
                lineHeight: 0,
                padding: 0,
                borderRadius: 999,
                border: `1px solid ${line}`,
                background: "#fff",
                color: inkMute,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <X size={7} />
            </button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={title}
        title={title}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={swatchBox}
      >
        <span style={{ display: "block", width: "100%", height: "100%", background: preview }} />
      </button>

      {onClear && (
        <button
          type="button"
          title={clearLabel}
          onClick={onClear}
          style={{ ...field, padding: "6px 8px", cursor: "pointer", fontSize: 11 }}
        >
          {clearLabel}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={title}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 45,
            width: 244,
            background: "#fff",
            border: `1px solid ${line}`,
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(11,31,51,0.14)",
            padding: 10
          }}
        >
          {onGradientChange && (
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setTab("solid");
                  onGradientChange(null);
                }}
                style={{ ...tiny(tab === "solid"), flex: 1, textAlign: "center" }}
              >
                Solid
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setTab("gradient");
                  setStopIndex(0);
                  // Seed from the colour already there, so switching tab is not a reset.
                  if (!gradient) onGradientChange(defaultGradient(toHex(rgba), "#ffffff"));
                }}
                style={{ ...tiny(tab === "gradient"), flex: 1, textAlign: "center" }}
              >
                Gradient
              </div>
            </div>
          )}

          {gradientMode && (
            <>
              <div
                ref={railRef}
                onPointerDown={addStop}
                title="Click to add a stop"
                style={{
                  height: 20,
                  borderRadius: 6,
                  border: `1px solid ${line}`,
                  background: gradientCss({ ...gradient, type: "linear", angle: 90 }),
                  position: "relative",
                  cursor: "copy",
                  marginBottom: 14
                }}
              >
                {gradient.stops.map((s, i) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    aria-label={`Stop ${i + 1} at ${s.at}%`}
                    title={`${s.color} at ${s.at}%`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setStopIndex(i);
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) moveStop(e, i);
                    }}
                    onPointerUp={(e) => {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                      setGradient(gradient);
                    }}
                    style={{
                      position: "absolute",
                      left: `calc(${s.at}% - 6px)`,
                      top: -4,
                      width: 12,
                      height: 26,
                      borderRadius: 4,
                      background: s.color,
                      border: `2px solid ${i === stopIndex ? ink : "#fff"}`,
                      boxShadow: "0 1px 4px rgba(11,31,51,0.3)",
                      cursor: "grab"
                    }}
                  />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setGradient({ ...gradient, type: "linear" })}
                  style={tiny(gradient.type === "linear")}
                >
                  Linear
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setGradient({ ...gradient, type: "radial" })}
                  style={tiny(gradient.type === "radial")}
                >
                  Radial
                </div>
                <button
                  type="button"
                  title="Remove this stop"
                  aria-label="Remove this stop"
                  disabled={gradient.stops.length <= MIN_STOPS}
                  onClick={() => removeStop(stopIndex)}
                  style={{
                    ...field,
                    marginLeft: "auto",
                    padding: "4px 6px",
                    lineHeight: 0,
                    cursor: gradient.stops.length <= MIN_STOPS ? "not-allowed" : "pointer",
                    opacity: gradient.stops.length <= MIN_STOPS ? 0.4 : 1
                  }}
                >
                  <X size={11} />
                </button>
              </div>

              {gradient.type === "linear" && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: font, fontSize: 10.5, color: inkMute, width: 34 }}>Angle</span>
                  <input
                    type="range"
                    min={0}
                    max={359}
                    value={gradient.angle}
                    aria-label="Gradient angle"
                    onChange={(e) => setGradient({ ...gradient, angle: Number(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontFamily: font, fontSize: 10.5, color: ink, width: 30, textAlign: "right" }}>
                    {gradient.angle}°
                  </span>
                </label>
              )}
            </>
          )}

          <div
            ref={squareRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              pickFromSquare(e);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) pickFromSquare(e);
            }}
            onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
            role="application"
            aria-label="Saturation and lightness"
            style={{
              position: "relative",
              height: 108,
              borderRadius: 8,
              border: `1px solid ${line}`,
              cursor: "crosshair",
              touchAction: "none",
              backgroundImage: [
                "linear-gradient(to bottom, #fff 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0) 50%, #000 100%)",
                `linear-gradient(to right, #808080, hsl(${hsl.h}, 100%, 50%))`
              ].join(", ")
            }}
          >
            <div
              style={{
                position: "absolute",
                left: `calc(${hsl.s}% - 6px)`,
                top: `calc(${100 - hsl.l}% - 6px)`,
                width: 12,
                height: 12,
                borderRadius: 999,
                border: "2px solid #fff",
                boxShadow: "0 0 0 1px rgba(11,31,51,0.5)",
                pointerEvents: "none"
              }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 6px" }}>
            <span style={{ fontFamily: font, fontSize: 10.5, color: inkMute, width: 34 }}>Hue</span>
            <input
              type="range"
              min={0}
              max={359}
              value={hsl.h}
              aria-label="Hue"
              onChange={(e) => setHsl(Number(e.target.value), hsl.s, hsl.l)}
              style={{ flex: 1, background: HUES, borderRadius: 999, height: 8, appearance: "auto" }}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: font, fontSize: 10.5, color: inkMute, width: 34 }}>Alpha</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(alphaOf(active) * 100)}
              aria-label="Opacity"
              onChange={(e) => {
                commit(withAlpha(active, Number(e.target.value) / 100));
                setTyped(null);
              }}
              style={{ flex: 1 }}
            />
            <span style={{ fontFamily: font, fontSize: 10.5, color: ink, width: 30, textAlign: "right" }}>
              {Math.round(alphaOf(active) * 100)}%
            </span>
          </label>

          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              value={text}
              aria-label="Colour value"
              spellCheck={false}
              onChange={(e) => applyTyped(e.target.value)}
              onBlur={() => setTyped(null)}
              style={{ ...field, flex: 1, minWidth: 0 }}
            />
            {hasEyeDropper && (
              <button
                type="button"
                title="Pick a colour from the screen"
                aria-label="Pick a colour from the screen"
                onClick={eyedropper}
                style={{ ...field, padding: "5px 6px", lineHeight: 0, cursor: "pointer" }}
              >
                <Pipette size={13} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            {(["hex", "rgb", "hsl"] as Format[]).map((f) => (
              <div
                key={f}
                role="button"
                tabIndex={0}
                aria-label={f.toUpperCase()}
                onClick={() => {
                  setFormat(f);
                  setTyped(null);
                }}
                style={{ ...tiny(format === f), flex: 1, textAlign: "center" }}
              >
                {f.toUpperCase()}
              </div>
            ))}
          </div>

          {recent.length > 0 && (
            <>
              <div style={sectionLabel}>Recent</div>
              <Swatches colours={recent.slice(0, MAX_RECENT)} onPick={(c) => commit(c)} />
            </>
          )}

          {documentColors.length > 0 && (
            <>
              <div style={sectionLabel}>In this deck</div>
              <Swatches colours={documentColors} onPick={(c) => commit(c, true)} />
            </>
          )}

          {brand.length > 0 && (
            <>
              <div style={sectionLabel}>Brand</div>
              <Swatches colours={brand} onPick={(c) => commit(c, true)} />
            </>
          )}

          {onPaletteChange && (
            <>
              <div style={sectionLabel}>Saved</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatches
                  colours={palette}
                  onPick={(c) => commit(c, true)}
                  removable={(c) => onPaletteChange(palette.filter((p) => p !== c))}
                />
                <button
                  type="button"
                  title="Save this colour to the deck"
                  aria-label="Save this colour to the deck"
                  onClick={() => {
                    if (!palette.includes(active)) onPaletteChange([...palette, active]);
                  }}
                  style={{ ...field, padding: "3px 5px", lineHeight: 0, cursor: "pointer" }}
                >
                  <Plus size={11} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
