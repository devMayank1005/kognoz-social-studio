"use client";

import React from "react";
import { Type, Sliders, Wand2 } from "lucide-react";

// The right-hand inspector's tab frame, ported from the reference.
//
// It owns the tabs and nothing else — each panel's contents stay in Studio.tsx with the
// state they operate on. Lifting the fields out too would mean threading a dozen setters
// through props for no gain.

export type InspectorTab = "content" | "design" | "ai";

const TABS: { id: InspectorTab; label: string; icon: typeof Type; accent?: boolean }[] = [
  { id: "content", label: "Content", icon: Type },
  { id: "design", label: "Design", icon: Sliders },
  // The AI tab's glyph is accented in the reference — it is the one that spends money.
  { id: "ai", label: "AI", icon: Wand2, accent: true }
];

export function Inspector({
  tab,
  onTab,
  children
}: {
  tab: InspectorTab;
  onTab: (t: InspectorTab) => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        role="tablist"
        aria-label="Inspector"
        className="h-11 px-2 border-b border-slate-200 flex items-center gap-1 bg-slate-50/70 text-xs font-medium shrink-0"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => onTab(t.id)}
              className={`flex-1 py-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                on ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${t.accent ? "text-[var(--brand-accent-soft)]" : "text-slate-600"}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
    </>
  );
}

/**
 * A labelled field with a live character count, as the reference shows on every
 * inspector input.
 *
 * The count is the point: these strings are rendered into a fixed 1080×1350 frame, and
 * an over-long headline does not wrap gracefully — it shrinks the type until the slide
 * looks wrong. Seeing the number while typing is cheaper than seeing it on the canvas.
 */
export function InspectorField({
  label,
  value,
  children
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1.5 gap-2">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
          {value.length} chars
        </span>
      </div>
      {children}
    </div>
  );
}
