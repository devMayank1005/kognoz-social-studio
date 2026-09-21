"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { useBrandSwitch } from "@/components/BrandProvider";
import { Logo } from "@/components/Logo";
import { BRAND_IDS, BRANDS } from "@/lib/brands";
import { SECTIONS, sectionItems, activeNavId, type NavItem } from "@/lib/navigation";
import { NAV_ICONS } from "./navIcons";
import { BRAND_DESCRIPTOR, CHROME_OK as OK } from "./brandChrome";

// The navigation rail.
//
// COLOUR comes from CSS variables (--rail, --brand-gradient, …) defined in app/globals.css
// and redefined under :root[data-brand="konverz"]. Nothing here reads the palette directly,
// so switching brand repaints the whole frame in one go rather than component by component.
// The ground was Tailwind's slate-900 until this pass; it is now Kognoz navy, taken down
// from brand blue (C.blue in lib/tokens.ts).
//
// THE ACTIVE ROW is marked by a 3px bar in the brand gradient. That gradient appears nowhere
// else in the chrome, which is what makes it read as "you are here" rather than decoration.
//
// COLLAPSED, the rail is 64px: icons only, labels carried by `title` so hovering still tells
// you where you are going. An earlier comment in AppShell argued there was no useful narrow
// state; there is, and it is this one — the canvas is 1080px wide and every pixel counts on
// a laptop.

export const SIDEBAR_WIDTH = 232;
export const SIDEBAR_WIDTH_COLLAPSED = 64;

export interface SidebarCounts {
  /** Shown beside Calendar. Supplied by the page; the rail never fetches. */
  calendar?: number;
  /** Shown beside Voice. */
  voice?: number;
}

export function Sidebar({
  counts,
  onOpenSettings,
  collapsed = false,
  onToggleCollapsed
}: {
  counts?: SidebarCounts;
  onOpenSettings?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { brandId, setBrandId } = useBrandSwitch();

  const isAdmin = session?.user?.isAdmin;
  const active = activeNavId(pathname);
  const brand = BRANDS[brandId];

  const name = session?.user?.name || session?.user?.email?.split("@")[0] || "";
  const initial = (name[0] || "?").toUpperCase();

  // A mark is only usable in the 64px rail if it is roughly square. Konverz has no mark
  // file yet — `logos.mark` is its 6.24:1 wordmark — so it falls back to a lettered tile
  // rather than being squashed.
  const squareMark = brand.logos.markAspect <= 1.6;

  return (
    <aside
      id="app-sidebar"
      style={{
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH,
        background: "var(--rail)",
        borderColor: "var(--rail-border)",
        color: "var(--rail-text)",
        fontFamily: "var(--font-ui)"
      }}
      // NOT transitioned. The stored width is applied in a layout effect, i.e. before the
      // first paint, so a width transition would start from a value the browser never
      // painted — and it then leaves the box at that start value indefinitely. Observed:
      // inline width 64px, measured width 232px, a second after load. Snapping is correct
      // and, on a rail wrapping a scroll container, cheaper than animating layout anyway.
      className="shrink-0 flex flex-col h-screen border-r select-none z-30"
    >
      {/* Brand header — 64px, matching the topbar so the two rules line up. */}
      <div
        className={`h-16 flex items-center border-b shrink-0 ${collapsed ? "justify-center px-0" : "px-4"}`}
        style={{ borderColor: "var(--rail-border)" }}
      >
        <Link
          href="/studio"
          className="flex items-center gap-2.5 min-w-0"
          aria-label={`${brand.name} Social Studio — go to Studio`}
          title={collapsed ? `${brand.label} Social Studio` : undefined}
        >
          {squareMark ? (
            <Logo brand={brand} mark h={28} style={{ objectPosition: "center" }} />
          ) : (
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-white shrink-0"
              style={{ background: "var(--brand-gradient)", fontFamily: "var(--font-ui)" }}
            >
              {brand.label[0]}
            </span>
          )}
          {!collapsed && (
            <span className="truncate">
              <span
                className="font-semibold text-[11px] tracking-[0.14em] uppercase block truncate"
                style={{ color: "var(--rail-text-strong)" }}
              >
                Social Studio
              </span>
              <span className="text-[10px] block truncate opacity-70">
                {brand.label} · {BRAND_DESCRIPTOR[brandId]}
              </span>
            </span>
          )}
        </Link>
      </div>

      <div className={`flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-5 ${collapsed ? "px-2" : "px-3"}`}>
        {SECTIONS.map((section) => {
          const items = sectionItems(section.id, isAdmin);
          // A section whose rows are all admin-only must not leave its heading behind.
          if (!items.length) return null;

          return (
            <div key={section.id}>
              {collapsed ? (
                <div className="h-px mx-2 mb-2" style={{ background: "var(--rail-border)" }} aria-hidden />
              ) : (
                <SectionLabel>{section.label}</SectionLabel>
              )}
              <nav className="space-y-0.5" aria-label={section.label}>
                {items.map((item) => (
                  <NavRow
                    key={item.id}
                    item={item}
                    active={active === item.id}
                    collapsed={collapsed}
                    count={item.id === "calendar" ? counts?.calendar : item.id === "voice" ? counts?.voice : undefined}
                    onOpenSettings={onOpenSettings}
                  />
                ))}
              </nav>

              {/* The brand switcher sits between Workspace and Style. It is rendered here
                  rather than as a section of its own because its rows switch state, they
                  do not navigate. */}
              {section.id === "workspace" && (
                <div className="pt-5">
                  {!collapsed && <SectionLabel>Brand</SectionLabel>}
                  <div className="space-y-1">
                    {BRAND_IDS.map((id) => {
                      const on = brandId === id;
                      const b = BRANDS[id];
                      return (
                        <button
                          key={id}
                          id={`brand-switch-${id}`}
                          type="button"
                          onClick={() => setBrandId(id)}
                          aria-pressed={on}
                          title={collapsed ? `${b.label} · ${BRAND_DESCRIPTOR[id]}` : undefined}
                          className={`w-full flex items-center rounded-md text-left transition-colors ${
                            collapsed ? "justify-center py-2" : "justify-between px-2.5 py-2"
                          }`}
                          style={
                            on
                              ? { background: "var(--rail-active)", color: "var(--rail-text-strong)" }
                              : { color: "var(--rail-text)" }
                          }
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: on ? "var(--brand-accent-soft)" : "var(--rail-border)" }}
                            />
                            {!collapsed && <span className="truncate text-xs">{b.label}</span>}
                          </span>
                          {!collapsed && <span className="text-[10px] opacity-70">{BRAND_DESCRIPTOR[id]}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onToggleCollapsed && (
        <button
          id="sidebar-collapse-btn"
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={`h-9 flex items-center gap-2 text-[11px] border-t shrink-0 transition-colors ${
            collapsed ? "justify-center px-0" : "px-4"
          }`}
          style={{ borderColor: "var(--rail-border)", color: "var(--rail-text)" }}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      )}

      {session?.user && (
        <div className={`border-t shrink-0 ${collapsed ? "p-2" : "p-3"}`} style={{ borderColor: "var(--rail-border)" }}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                style={{
                  background: "var(--rail-active)",
                  color: "var(--rail-text-strong)",
                  boxShadow: "inset 0 0 0 1px var(--brand-accent-soft)"
                }}
                title={collapsed ? `${name} · ${isAdmin ? "Administrator" : "Editor"}` : undefined}
              >
                {initial}
              </span>
              {!collapsed && (
                <span className="truncate">
                  <span
                    className="font-medium text-xs flex items-center gap-1.5 truncate"
                    style={{ color: "var(--rail-text-strong)" }}
                  >
                    <span className="truncate">{name}</span>
                    <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: OK }} />
                  </span>
                  <span className="text-[10px] block truncate opacity-70">{isAdmin ? "Administrator" : "Editor"}</span>
                </span>
              )}
            </div>
            {!collapsed && (
              <button
                id="sidebar-logout-btn"
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 rounded transition-colors hover:bg-white/10"
                style={{ color: "var(--rail-text)" }}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.09em] opacity-60"
      style={{ color: "var(--rail-text)" }}
    >
      {children}
    </div>
  );
}

function NavRow({
  item,
  active,
  collapsed,
  count,
  onOpenSettings
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  count?: number;
  onOpenSettings?: () => void;
}) {
  const Icon = NAV_ICONS[item.id];

  const shell = `relative w-full flex items-center rounded-md text-[13px] font-semibold transition-colors text-left ${
    collapsed ? "justify-center py-2.5" : "gap-2.5 px-2.5 py-2"
  } ${active ? "" : "hover:bg-white/[0.06]"}`;

  const style: React.CSSProperties = active
    ? { background: "var(--rail-active)", color: "var(--rail-text-strong)" }
    : { color: "var(--rail-text)" };

  const inner = (
    <>
      {/* The one place the brand gradient appears in the chrome. */}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full"
          style={{ background: "var(--brand-gradient)" }}
        />
      )}
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}

      {!collapsed && item.badge === "chip" && item.badgeText && (
        <span
          className="ml-auto text-[10px] px-1.5 py-0.5 rounded border"
          style={{ color: "var(--brand-accent-soft)", borderColor: "var(--rail-border)" }}
        >
          {item.badgeText}
        </span>
      )}

      {/* A count renders only once it is known. Showing 0 while loading would read as
          "you have nothing", which is a different claim from "not counted yet". */}
      {!collapsed && item.badge === "count" && typeof count === "number" && (
        <span className="ml-auto text-[10px] font-mono tabular-nums opacity-70">{count}</span>
      )}

      {item.badge === "dot" && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${collapsed ? "absolute top-1.5 right-2.5" : "ml-auto"}`}
          style={{ background: OK }}
          aria-hidden
        />
      )}
    </>
  );

  // Settings opens an overlay; everything else navigates.
  if (item.modal || !item.href) {
    return (
      <button
        id={`nav-${item.id}-btn`}
        type="button"
        onClick={onOpenSettings}
        title={collapsed ? item.label : item.hint}
        aria-label={item.label}
        className={shell}
        style={style}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      id={`nav-${item.id}-btn`}
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : item.hint}
      aria-label={item.label}
      className={shell}
      style={style}
    >
      {inner}
    </Link>
  );
}
