"use client";

// The Shape button and the library behind it.
//
// This replaces four toolbar buttons — Rectangle, Rounded, Ellipse, Line — that between
// them offered three shapes and took up half the row.
//
// EVERY TILE DRAWS ITS OWN SHAPE rather than an icon from a set. The path function is
// already in hand (lib/shapeLibrary.ts), so this costs nothing, and it is the one place an
// icon library would quietly lie: pick the tile that looks like a pentagon and get exactly
// that pentagon, at the proportions it will land on the slide.
//
// Editor chrome: this renders outside the node the exporter clones, so it is free to use
// form controls and anything else a slide may never contain.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SHAPE_CATEGORIES,
  STROKE_ONLY,
  pathFor,
  searchShapes,
  type ShapeSpec
} from "@/lib/shapeLibrary";

const COLUMNS = 4;
const TILE = 54;
/** The preview box each tile draws into. Wider than tall, like most of the shapes. */
const PV_W = 34;
const PV_H = 26;

export interface ShapePickerProps {
  onPick: (spec: ShapeSpec) => void;
  font: string;
  ink: string;
  line: string;
  inkMute: string;
  /** Brand accent, used for the preview fill so the tiles look like the deck. */
  accent: string;
}

function Preview({ spec, accent }: { spec: ShapeSpec; accent: string }) {
  const inked = STROKE_ONLY.has(spec.kind);
  return (
    <svg width={PV_W} height={PV_H} viewBox={`0 0 ${PV_W} ${PV_H}`} aria-hidden style={{ display: "block" }}>
      <path
        d={pathFor(spec.kind, PV_W, PV_H)}
        fill={inked ? "none" : accent}
        stroke={inked ? accent : "none"}
        strokeWidth={inked ? 3 : 0}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ShapePicker({ onPick, font, ink, line, inkMute, accent }: ShapePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchShapes(query), [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  const pick = useCallback(
    (spec: ShapeSpec) => {
      onPick(spec);
      close();
    },
    [onPick, close]
  );

  // Close on a press anywhere else, and on Escape. Both are what people try first, and a
  // popover that only closes by pressing its own button reads as stuck.
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

  // Typing narrows the list; the highlight must not be left pointing past the end.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, results.length - 1)));
  }, [results.length]);

  function onSearchKey(e: React.KeyboardEvent) {
    if (!results.length) return;
    const step =
      e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? COLUMNS : e.key === "ArrowUp" ? -COLUMNS : 0;
    if (step) {
      e.preventDefault();
      setCursor((c) => Math.max(0, Math.min(results.length - 1, c + step)));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      pick(results[cursor]);
    }
  }

  const chip: React.CSSProperties = {
    cursor: "pointer",
    userSelect: "none",
    fontFamily: font,
    fontSize: 12.5,
    fontWeight: 700,
    padding: "7px 12px",
    borderRadius: 999,
    border: `1px solid ${open ? ink : line}`,
    background: open ? ink : "#fff",
    color: open ? "#fff" : ink,
    display: "inline-flex",
    alignItems: "center",
    gap: 7
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={chip}
      >
        <svg width={13} height={11} viewBox="0 0 13 11" aria-hidden style={{ display: "block" }}>
          <path d={pathFor("pentagon", 13, 11)} fill="currentColor" />
        </svg>
        <span>Shape</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </div>

      {open && (
        <div
          role="menu"
          aria-label="Shapes"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 30,
            width: COLUMNS * TILE + 28,
            maxHeight: 340,
            overflowY: "auto",
            background: "#fff",
            border: `1px solid ${line}`,
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(11,31,51,0.14)",
            padding: 10
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Search shapes…"
            aria-label="Search shapes"
            style={{
              fontFamily: font,
              fontSize: 12.5,
              width: "100%",
              boxSizing: "border-box",
              padding: "7px 9px",
              marginBottom: 8,
              border: `1px solid ${line}`,
              borderRadius: 8,
              color: ink,
              outline: "none"
            }}
          />

          {results.length === 0 && (
            <div style={{ fontFamily: font, fontSize: 12, color: inkMute, padding: "12px 4px" }}>
              No shape matches that.
            </div>
          )}

          {/* While searching, the headings would be noise — show one flat grid instead. */}
          {(query.trim()
            ? [{ id: "results" as const, label: "", specs: results }]
            : SHAPE_CATEGORIES.map((c) => ({
                id: c.id,
                label: c.label,
                specs: results.filter((s) => s.category === c.id)
              }))
          ).map((group) =>
            group.specs.length === 0 ? null : (
              <div key={group.id}>
                {group.label && (
                  <div
                    style={{
                      fontFamily: font,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: inkMute,
                      margin: "8px 4px 4px"
                    }}
                  >
                    {group.label}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`, gap: 2 }}>
                  {group.specs.map((spec) => {
                    const on = results.indexOf(spec) === cursor;
                    return (
                      <div
                        key={spec.id}
                        role="menuitem"
                        title={spec.label}
                        onClick={() => pick(spec)}
                        onMouseEnter={() => setCursor(results.indexOf(spec))}
                        style={{
                          height: TILE,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 8,
                          cursor: "pointer",
                          border: `1px solid ${on ? ink : "transparent"}`,
                          background: on ? "rgba(11,31,51,0.05)" : "transparent"
                        }}
                      >
                        <Preview spec={spec} accent={accent} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
