"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "@/components/Logo";
import { BrandSwitch } from "@/components/BrandSwitch";
import { useBrand } from "@/components/BrandProvider";
import { UI_FONT } from "@/lib/tokens";
import { visibleNavItems, activeNavId } from "@/lib/navigation";
import { NavIcon } from "./NavIcon";

// The 232px rail. PRD §3: brand switcher, primary navigation, user status.
//
// It reads `useBrand()` for its palette, so the chrome itself carries the active brand
// rather than only the canvas doing it — switching to Konverz should be visible without
// having to look at a slide.
//
// Every destination comes from lib/navigation.ts. Nothing here hardcodes a route, so
// the rail and the ⌘K palette cannot end up listing different things.

export const SIDEBAR_WIDTH = 232;

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const brand = useBrand();
  const C = brand.C;

  const items = visibleNavItems(session?.user?.isAdmin);
  const active = activeNavId(pathname);

  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: "18px 14px",
        boxSizing: "border-box",
        borderRight: `1px solid ${C.line}`,
        background: C.off,
        fontFamily: UI_FONT
      }}
    >
      <Link href="/studio" aria-label="Social Studio — go to Studio" style={{ display: "block", padding: "2px 4px" }}>
        <Logo h={30} />
      </Link>

      {/* Reuses the existing switcher, which already persists the choice to
          localStorage and to /api/store — see components/BrandProvider.tsx. */}
      <div>
        <SectionLabel color={C.inkMute}>Brand</SectionLabel>
        <BrandSwitch />
      </div>

      <nav aria-label="Main" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <SectionLabel color={C.inkMute}>Workspace</SectionLabel>
        {items.map((item) => {
          const on = active === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              // Announces the current page to a screen reader; the colour alone
              // would say nothing to one.
              aria-current={on ? "page" : undefined}
              title={item.hint}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: on ? 700 : 500,
                textDecoration: "none",
                color: on ? C.blue : C.inkSoft,
                background: on ? C.mist : "transparent"
              }}
            >
              <NavIcon id={item.id} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Pushes the user block to the bottom of the rail. */}
      <div style={{ flex: 1 }} />

      {session?.user && (
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: C.ink,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
            title={session.user.email || undefined}
          >
            {session.user.name || session.user.email}
          </div>
          {session.user.name && session.user.email && (
            <div
              style={{
                fontSize: 11,
                color: C.inkMute,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: 1
              }}
            >
              {session.user.email}
            </div>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{
              marginTop: 8,
              width: "100%",
              fontFamily: UI_FONT,
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 10px",
              borderRadius: 7,
              border: `1px solid ${C.line}`,
              background: C.white,
              color: C.inkMute,
              cursor: "pointer"
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.7,
        textTransform: "uppercase",
        color,
        margin: "0 4px 7px"
      }}
    >
      {children}
    </div>
  );
}
