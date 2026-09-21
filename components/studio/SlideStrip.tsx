"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// The deck's slides, in the two places the reference shows them: a titled list down the
// left column, and a numbered strip under the canvas.
//
// One component, two placements, one `current` — so the list and the strip cannot end up
// disagreeing about which slide you are on. They did in the reference, which tracks the
// index in two separate handlers.
//
// Numbers are padded and monospaced so the column of them stays straight at 10+ slides;
// `tabular-nums` matters here because Plus Jakarta's proportional 1 is much narrower
// than its 0.

export interface StripSlide {
  /** 1-based, as shown. */
  n: number;
  /** What the row reads; falls back to a placeholder rather than rendering blank. */
  title: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The titled list in the left column. */
export function SlideList({
  slides,
  current,
  onSelect
}: {
  slides: StripSlide[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="p-3 flex-1 overflow-y-auto space-y-1">
      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        Slides ({slides.length})
      </div>
      {slides.map((s, i) => {
        const on = i === current;
        return (
          <button
            key={`${s.n}-${i}`}
            type="button"
            onClick={() => onSelect(i)}
            aria-current={on ? "true" : undefined}
            className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-start gap-2.5 ${
              on ? "bg-slate-900 text-white font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span className="font-mono tabular-nums text-[10px] opacity-60 mt-0.5 shrink-0">{pad(s.n)}</span>
            <span className="truncate leading-tight">{s.title || <em className="opacity-60">Untitled</em>}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The ‹ 01 / 07 › pager and numbered strip beneath the canvas. */
export function SlidePager({
  slides,
  current,
  onSelect
}: {
  slides: StripSlide[];
  current: number;
  onSelect: (index: number) => void;
}) {
  const total = slides.length;
  if (!total) return null;

  // Wraps at both ends. Walking off the end of a 7-slide deck and having to click back
  // six times is the kind of small rudeness that makes a tool tiring.
  const step = (delta: number) => onSelect((current + delta + total) % total);

  return (
    <div className="shrink-0 flex flex-col items-center gap-3 pb-5 pt-1">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous slide"
          className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="font-mono tabular-nums text-xs text-slate-500">
          {pad(current + 1)} / {pad(total)}
        </span>

        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next slide"
          className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white border border-slate-200">
        {slides.map((s, i) => {
          const on = i === current;
          return (
            <button
              key={`pager-${s.n}-${i}`}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Slide ${s.n}`}
              aria-current={on ? "true" : undefined}
              className={`px-2.5 py-1 rounded-lg font-mono tabular-nums text-[11px] transition-colors ${
                on ? "bg-slate-900 text-white font-semibold" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              {pad(s.n)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
