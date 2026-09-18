"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useBrandSwitch } from "@/components/BrandProvider";
import { BRAND_IDS, BRANDS } from "@/lib/brands";
import { SECTIONS, sectionItems, activeNavId, type NavItem } from "@/lib/navigation";
import { NAV_ICONS } from "./navIcons";
import {
  BRAND_DESCRIPTOR,
  BRAND_AVATAR,
  BRAND_RING,
  BRAND_DOT,
  CHROME_ACCENT as ACCENT,
  CHROME_OK as OK
} from "./brandChrome";

// The 232px rail, ported from the reference UI
// (demo-frontend/src/components/Sidebar.tsx) with our palette substituted.
//
// COLOURS. The reference's cyan is #06B6D4 and its violet #8B5CF6; ours are #43AFCD and
// #6B4FC9. Every accent below is ours. The slate ground (#0F172A) is kept: it is not a
// brand colour, it is the dark surface our accents sit on.
//
// The active-row accent is CYAN FOR BOTH BRANDS — that is what the reference does, and
// it is worth stating because it looks like an oversight until you see why: the chrome
// stays still while you switch, and brand identity is carried by the avatar gradient and
// the ring on the active brand row instead. Reading the screenshot alone, I had guessed
// the opposite.


export const SIDEBAR_WIDTH = 232;

export interface SidebarCounts {
  /** Shown beside Calendar. Supplied by the page; the rail never fetches. */
  calendar?: number;
  /** Shown beside Voice. */
  voice?: number;
}

export function Sidebar({
  counts,
  onOpenSettings
}: {
  counts?: SidebarCounts;
  onOpenSettings?: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { brandId, setBrandId } = useBrandSwitch();

  const isAdmin = session?.user?.isAdmin;
  const active = activeNavId(pathname);
  const brand = BRANDS[brandId];

  const name = session?.user?.name || session?.user?.email?.split("@")[0] || "";
  const initial = (name[0] || "?").toUpperCase();

  return (
    <aside
      id="app-sidebar"
      className="w-[232px] shrink-0 bg-[#0F172A] text-slate-300 flex flex-col h-screen border-r border-slate-800 select-none z-30"
    >
      {/* Brand header — 64px, matching the topbar's height so the two rules line up. */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
        <Link href="/studio" className="flex items-center gap-2.5 min-w-0" aria-label="Social Studio — go to Studio">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-white shadow-sm transition-colors duration-300 ${BRAND_AVATAR[brandId]}`}
            style={{ fontFamily: brand.displayFont }}
          >
            K
          </div>
          <div className="truncate">
            <span className="font-semibold text-xs text-white tracking-wider uppercase block truncate">
              Social Studio
            </span>
            <span className="text-[10px] text-slate-400 truncate block">
              {brand.label} · {BRAND_DESCRIPTOR[brandId]}
            </span>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 text-xs">
        {SECTIONS.map((section) => {
          const items = sectionItems(section.id, isAdmin);
          // A section whose rows are all admin-only must not leave its heading behind.
          if (!items.length) return null;

          return (
            <div key={section.id}>
              <SectionLabel>{section.label}</SectionLabel>
              <nav className="space-y-0.5" aria-label={section.label}>
                {items.map((item) => (
                  <NavRow
                    key={item.id}
                    item={item}
                    active={active === item.id}
                    count={item.id === "calendar" ? counts?.calendar : item.id === "voice" ? counts?.voice : undefined}
                    onOpenSettings={onOpenSettings}
                  />
                ))}
              </nav>

              {/* The brand switcher sits between Workspace and Style, as in the
                  reference. It is rendered here rather than as a section of its own
                  because its rows switch state, they do not navigate. */}
              {section.id === "workspace" && (
                <div className="pt-6">
                  <SectionLabel>Brand</SectionLabel>
                  <div className="space-y-1">
                    {BRAND_IDS.map((id) => {
                      const on = brandId === id;
                      return (
                        <button
                          key={id}
                          id={`brand-switch-${id}`}
                          type="button"
                          onClick={() => setBrandId(id)}
                          aria-pressed={on}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left transition-all ${
                            on
                              ? `bg-slate-800 text-white font-medium ${BRAND_RING[id]}`
                              : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${on ? BRAND_DOT[id] : "bg-slate-600"}`} />
                            <span>{BRANDS[id].label}</span>
                          </span>
                          <span className="text-[10px] text-slate-400">{BRAND_DESCRIPTOR[id]}</span>
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

      {/* User footer */}
      {session?.user && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs ring-1 shrink-0"
                style={{ color: ACCENT, borderColor: ACCENT }}
              >
                {initial}
              </div>
              <div className="truncate">
                <div className="font-medium text-xs text-slate-200 flex items-center gap-1.5 truncate">
                  <span className="truncate">{name}</span>
                  <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: OK }} />
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {isAdmin ? "Administrator" : "Editor"}
                </div>
              </div>
            </div>
            <button
              id="sidebar-logout-btn"
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{children}</div>
  );
}

function NavRow({
  item,
  active,
  count,
  onOpenSettings
}: {
  item: NavItem;
  active: boolean;
  count?: number;
  onOpenSettings?: () => void;
}) {
  const Icon = NAV_ICONS[item.id];

  const shell = `w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium transition-colors text-left ${
    active
      ? "bg-[#43AFCD]/15 text-[#43AFCD] font-semibold border-l-2 border-[#43AFCD] rounded-l-none"
      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
  }`;

  const inner = (
    <>
      <Icon className="w-4 h-4 shrink-0" style={{ color: active || item.id === "studio" ? ACCENT : undefined }} />
      <span>{item.label}</span>

      {item.badge === "chip" && item.badgeText && (
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[#43AFCD]/10 text-[#43AFCD] border border-[#43AFCD]/30">
          {item.badgeText}
        </span>
      )}

      {/* A count renders only once it is known. Showing 0 while loading would read as
          "you have nothing", which is a different claim from "not counted yet". */}
      {item.badge === "count" && typeof count === "number" && (
        <span className="ml-auto text-[10px] text-slate-400 font-mono tabular-nums">{count}</span>
      )}

      {item.badge === "dot" && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: OK }} aria-hidden />
      )}
    </>
  );

  // Settings opens an overlay; everything else navigates.
  if (item.modal || !item.href) {
    return (
      <button id={`nav-${item.id}-btn`} type="button" onClick={onOpenSettings} title={item.hint} className={shell}>
        {inner}
      </button>
    );
  }

  return (
    <Link
      id={`nav-${item.id}-btn`}
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.hint}
      className={shell}
    >
      {inner}
    </Link>
  );
}
