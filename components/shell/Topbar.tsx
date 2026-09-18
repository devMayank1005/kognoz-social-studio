"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useBrand } from "@/components/BrandProvider";
import { UI_FONT } from "@/lib/tokens";
import { activeNavId, navItem } from "@/lib/navigation";

// The 64px topbar. PRD §3: active brand badge, ⌘K search, page actions.
//
// Actions are supplied BY THE PAGE, not listed here. Fact-Check belongs to Studio and
// Export belongs wherever there is something to export; a topbar that owned them would
// have to know which page was mounted and grey them out everywhere else. Each page
// passes what it can actually do, through AppShell's `actions` prop.

export const TOPBAR_HEIGHT = 64;

export function Topbar({
  actions,
  onOpenCommandPalette
}: {
  actions?: React.ReactNode;
  onOpenCommandPalette?: () => void;
}) {
  const pathname = usePathname();
  const brand = useBrand();
  const C = brand.C;

  const current = activeNavId(pathname);
  const title = (current && navItem(current)?.label) || "Social Studio";

  return (
    <header
      style={{
        height: TOPBAR_HEIGHT,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 22px",
        boxSizing: "border-box",
        borderBottom: `1px solid ${C.line}`,
        background: C.white,
        fontFamily: UI_FONT
      }}
    >
      <h1 style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0, whiteSpace: "nowrap" }}>{title}</h1>

      {/* Which brand you are producing for. The rail has the switcher; this is the
          reminder that survives scrolling, because posting in the wrong brand's voice
          is the expensive mistake here. */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.3,
          color: "#fff",
          background: brand.GRAD,
          padding: "4px 11px",
          borderRadius: 12,
          whiteSpace: "nowrap"
        }}
      >
        {brand.label}
      </span>

      {onOpenCommandPalette && (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="Search and commands"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: 1,
            maxWidth: 380,
            marginLeft: 6,
            fontFamily: UI_FONT,
            fontSize: 12.5,
            textAlign: "left",
            padding: "7px 12px",
            borderRadius: 8,
            border: `1px solid ${C.line}`,
            background: C.off,
            color: C.inkMute,
            cursor: "pointer"
          }}
        >
          <span style={{ flex: 1 }}>Search or jump to…</span>
          <kbd
            style={{
              fontFamily: UI_FONT,
              fontSize: 10.5,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 5,
              border: `1px solid ${C.line}`,
              background: C.white,
              color: C.inkMute
            }}
          >
            ⌘K
          </kbd>
        </button>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>{actions}</div>
    </header>
  );
}
