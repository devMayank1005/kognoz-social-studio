"use client";

import React from "react";
import { useBrand } from "@/components/BrandProvider";
import { UI_FONT } from "@/lib/tokens";
import { Sidebar, SIDEBAR_WIDTH } from "./Sidebar";
import { Topbar, TOPBAR_HEIGHT } from "./Topbar";

// The two-tier chrome every signed-in screen sits inside. PRD §3.
//
// Wrapping each PAGE rather than the root layout is deliberate: /login must not get a
// sidebar, and a root-level shell would have to special-case it by pathname. Opting in
// per page keeps that decision where it is visible.
//
// The rail and the topbar are sticky so they survive scrolling. Studio's filmstrip and
// the calendar grid are both long, and chrome that scrolls away takes the brand badge
// and the navigation with it.

export function AppShell({
  children,
  actions,
  onOpenCommandPalette,
  /** Studio manages its own padding and full-bleed canvas; pages of text want the gutter. */
  padded = true
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
  onOpenCommandPalette?: () => void;
  padded?: boolean;
}) {
  const brand = useBrand();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: brand.C.white, fontFamily: UI_FONT }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar actions={actions} onOpenCommandPalette={onOpenCommandPalette} />

        <main
          // minHeight rather than height: a short page should not force a scrollbar,
          // a long one still scrolls inside this region.
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
            padding: padded ? "22px 26px 56px" : 0,
            boxSizing: "border-box"
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export { SIDEBAR_WIDTH, TOPBAR_HEIGHT };
