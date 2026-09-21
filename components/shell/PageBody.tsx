"use client";

// The scrolling body every screen except Studio sits in.
//
// It exists because six routes had each written the same wrapper by hand
// (`flex-1 overflow-y-auto px-6 py-6`) and a seventh — /voice — had written a different one,
// so padding and background quietly disagreed from page to page.
//
// The scroll lives here rather than on the document: AppShell pins the frame at h-screen so
// the rail and the top bar stay put while a long calendar or filmstrip moves underneath.
// Studio opts out entirely and manages its own three columns.

import React from "react";

export function PageBody({
  children,
  /** Constrain the reading width. Off for grids and tables that want the room. */
  narrow = false,
  className = ""
}: {
  children: React.ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex-1 overflow-y-auto px-6 py-6 ${className}`}
      style={{ background: "var(--surface-app)" }}
    >
      <div className={narrow ? "mx-auto w-full max-w-4xl" : "w-full"}>{children}</div>
    </div>
  );
}
