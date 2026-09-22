"use client";

import React from "react";

// The Studio frame: canvas on the left, inspector on the right.
//
// It was three columns until the 240px generation rail on the far left was folded into the
// inspector's Content and Design tabs. Nothing was lost in that move — the rail's other
// contents (logo, account badge, brand switch, Calendar link, slide list) each already
// existed in the app rail, the topbar or the centre column's slide pager.
//
// Pure layout — it holds no state and knows nothing about decks.
//
// The height is pinned to the viewport minus the 64px topbar, and each column scrolls
// independently. The alternative — letting the page scroll — takes the slide canvas out
// of view the moment you edit a long body field in the inspector.

export function StudioLayout({
  subHeader,
  center,
  right
}: {
  subHeader?: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-100">
      {subHeader && (
        <div className="h-12 px-4 md:px-6 bg-white border-b border-slate-200/90 flex items-center justify-between shrink-0 text-xs gap-3">
          {subHeader}
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">{center}</div>

        <div className="w-full md:w-80 bg-white border-l border-slate-200/90 flex flex-col shrink-0 overflow-hidden">
          {right}
        </div>
      </div>
    </div>
  );
}

/** The mono chip the sub-header and the canvas header both use. */
export function MonoChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] whitespace-nowrap">
      {children}
    </span>
  );
}

/** Small uppercase heading, used throughout the inspector. */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
      {children}
    </span>
  );
}
