"use client";

// The font picker: ~110 families, searchable, grouped, each row set in its own face.
//
// THE PROBLEM THIS SOLVES CAREFULLY. Showing a hundred font previews naively means loading a
// hundred fonts — several megabytes before anybody has picked anything. The page's own
// stylesheet (app/layout.tsx) deliberately carries only the brand's faces plus the UI's, and
// that is worth keeping.
//
// So a preview asks Google for ONLY the glyphs in the family's own name, via `&text=`. I
// measured it: about 2 KB a family, so eighty previews are ~154 KB rather than megabytes —
// and even that is only fetched for rows actually scrolled into view. The full family is
// loaded separately, once, when somebody actually picks it (Studio owns that link).
//
// The row is therefore an honest preview of the face and a dishonest preview of nothing
// else: it can render its own name and no other text, which is exactly what it is for.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FONT_CATEGORIES, stackFor, type FontCategory } from "@/lib/fontCatalogue";
import { categoryFor, facesFor, familyOf, type FontEntry } from "@/lib/fontRegistry";

const PREVIEW_LINK_PREFIX = "kz-font-preview-";

/** Ask for just the glyphs in the family's own name. ~2 KB instead of ~40 KB. */
export function previewHref(family: string): string {
  return `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}&text=${encodeURIComponent(family)}&display=swap`;
}

/** One <link> per family, added once and left in place — the browser caches it from there. */
function ensurePreviewLoaded(family: string) {
  const id = PREVIEW_LINK_PREFIX + family.replace(/[^a-zA-Z0-9]/g, "");
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = previewHref(family);
  document.head.appendChild(link);
}

export interface FontPickerProps {
  /** The current CSS stack, e.g. `'Inter', sans-serif`. */
  value: string;
  fonts: FontEntry[];
  onPick: (stack: string, family: string) => void;
  font: string;
  ink: string;
  line: string;
  inkMute: string;
}

export default function FontPicker({ value, fonts, onPick, font, ink, line, inkMute }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FontCategory | "all">("all");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const current = familyOf(value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fonts.filter((f) => {
      if (category !== "all" && categoryFor(f.family) !== category) return false;
      return !q || f.family.toLowerCase().includes(q);
    });
  }, [fonts, query, category]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCategory("all");
  }, []);

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

  // Load a row's face only once it is actually on screen. Without this, opening the picker
  // would fetch every family in the list whether or not anybody scrolled to it.
  useEffect(() => {
    if (!open) return;
    const root = listRef.current;
    if (!root) return;
    if (typeof IntersectionObserver === "undefined") {
      // jsdom, and any browser old enough not to have it: load them all rather than show
      // a hundred rows in the fallback face.
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-font]"))) {
        ensurePreviewLoaded(el.dataset.font ?? "");
      }
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const family = (entry.target as HTMLElement).dataset.font;
          if (family) ensurePreviewLoaded(family);
          io.unobserve(entry.target);
        }
      },
      { root, rootMargin: "120px" }
    );
    for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-font]"))) io.observe(el);
    return () => io.disconnect();
  }, [open, results]);

  const chip: React.CSSProperties = {
    cursor: "pointer",
    userSelect: "none",
    fontSize: 12.5,
    color: ink,
    border: `1px solid ${line}`,
    borderRadius: 8,
    padding: "6px 9px",
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minWidth: 150,
    justifyContent: "space-between"
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={chip}
      >
        {/* The button shows the current family IN that family — it is already loaded, since
            it is on the canvas. */}
        <span style={{ fontFamily: value, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current}
        </span>
        <span style={{ fontFamily: font, fontSize: 10, color: inkMute }}>▾</span>
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Font family"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 40,
            width: 288,
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
            placeholder="Search fonts…"
            aria-label="Search fonts"
            style={{
              fontFamily: font,
              fontSize: 12.5,
              width: "100%",
              boxSizing: "border-box",
              padding: "7px 9px",
              border: `1px solid ${line}`,
              borderRadius: 8,
              color: ink,
              outline: "none"
            }}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "8px 0" }}>
            {([{ id: "all" as const, label: "All" }, ...FONT_CATEGORIES]).map((c) => (
              <div
                key={c.id}
                onClick={() => setCategory(c.id as FontCategory | "all")}
                style={{
                  cursor: "pointer",
                  fontFamily: font,
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: `1px solid ${category === c.id ? ink : line}`,
                  background: category === c.id ? ink : "#fff",
                  color: category === c.id ? "#fff" : inkMute
                }}
              >
                {c.label}
              </div>
            ))}
          </div>

          <div ref={listRef} style={{ maxHeight: 300, overflowY: "auto" }}>
            {results.length === 0 && (
              <div style={{ fontFamily: font, fontSize: 12, color: inkMute, padding: "12px 4px" }}>
                No font matches that.
              </div>
            )}
            {results.map((f) => {
              const faces = facesFor(f.family);
              const on = f.family === current;
              const stack = stackFor({
                family: f.family,
                category: categoryFor(f.family),
                axis: f.axis,
                weights: faces.weights,
                italics: faces.italics
              });
              return (
                <div
                  key={f.family}
                  role="option"
                  aria-selected={on}
                  data-font={f.family}
                  title={f.family}
                  onClick={() => {
                    onPick(stack, f.family);
                    close();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "7px 8px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: on ? "rgba(11,31,51,0.06)" : "transparent"
                  }}
                >
                  <span
                    style={{
                      fontFamily: stack,
                      fontSize: 16,
                      color: ink,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {f.family}
                  </span>
                  <span style={{ fontFamily: font, fontSize: 9.5, color: inkMute, whiteSpace: "nowrap" }}>
                    {faces.weights.length}
                    {faces.italics.length ? " · italic" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
