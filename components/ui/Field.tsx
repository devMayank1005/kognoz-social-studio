"use client";

// Label + control + hint, with the character count that components/studio/Inspector.tsx
// got right first.
//
// The count is the point, and the reason it is worth generalising: these strings render
// into a fixed 1080×1350 frame, and an over-long headline does not wrap gracefully — it
// shrinks the type until the slide looks wrong. Seeing the number while typing is cheaper
// than seeing it on the canvas.

import React, { useId } from "react";

export function Field({
  label,
  hint,
  /** Pass the control's current text to show a live character count. */
  count,
  children
}: {
  label: string;
  hint?: React.ReactNode;
  count?: string;
  children: React.ReactNode | ((id: string) => React.ReactNode);
}) {
  const id = useId();
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1.5 gap-2">
        <label htmlFor={id} className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </label>
        {count !== undefined && (
          <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
            {count.length} chars
          </span>
        )}
      </div>
      {typeof children === "function" ? children(id) : children}
      {hint && <p className="mt-1 text-[10px] text-slate-400 leading-snug">{hint}</p>}
    </div>
  );
}

/** The input styling the overlays each rewrote; here so they stop diverging. */
export const FIELD_INPUT =
  "w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:border-transparent transition-shadow";
