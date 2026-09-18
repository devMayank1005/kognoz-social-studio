"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Search, HelpCircle, Sparkles, ShieldCheck, Download, Command, Menu } from "lucide-react";
import { useBrandSwitch } from "@/components/BrandProvider";
import { BRANDS, BRAND_IDS } from "@/lib/brands";
import { activeNavId, navItem } from "@/lib/navigation";
import { BRAND_DESCRIPTOR, BRAND_PILL, BRAND_PILL_DOT, BRAND_CREATE_BTN } from "./brandChrome";

// The 64px topbar, ported from the reference UI
// (demo-frontend/src/components/Topbar.tsx) with our palette.
//
// Its `emerald` utilities are left exactly as the reference has them, because Tailwind's
// emerald-600 is #059669 — our AUDIT_OK token to the digit. Status colour is not brand
// colour, and it should not move when you switch brands.
//
// Page titles come from lib/navigation.ts rather than a switch statement here: the rail
// says "Calendar" in 232px and the topbar says "Content Calendar", and those two strings
// living apart is how they drift.
//
// What this bar does NOT own is the second row of context — "Idea Deck · 7 slides",
// "Human Score", "Verify Facts". Those belong to Studio. A topbar holding them would
// have to know which page was mounted and blank them everywhere else, which is exactly
// the mess the hand-rolled per-page headers were.

export const TOPBAR_HEIGHT = 64;

export function Topbar({
  onOpenCommandPalette,
  onOpenHelp,
  onOpenFactCheck,
  onOpenExport,
  onCreate,
  onToggleMobileMenu
}: {
  onOpenCommandPalette?: () => void;
  onOpenHelp?: () => void;
  onOpenFactCheck?: () => void;
  onOpenExport?: () => void;
  onCreate?: () => void;
  onToggleMobileMenu?: () => void;
}) {
  const pathname = usePathname();
  const { brandId, setBrandId } = useBrandSwitch();

  const current = activeNavId(pathname);
  const title = (current && navItem(current)?.pageTitle) || "Social Studio";
  const brand = BRANDS[brandId];

  const toggleBrand = () => setBrandId(BRAND_IDS.find((id) => id !== brandId) ?? brandId);

  return (
    <header
      id="app-topbar"
      className="h-16 px-4 md:px-6 bg-white/90 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-20 transition-colors"
    >
      {/* Left: mobile menu, page title, brand pill */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            id="mobile-menu-toggle-btn"
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-sm md:text-base font-semibold text-slate-900 tracking-tight truncate">{title}</h1>

          <span className="hidden sm:inline-block text-slate-300">/</span>

          <button
            type="button"
            onClick={toggleBrand}
            title={`Producing for ${brand.name} — click to switch`}
            aria-label={`Brand: ${brand.name}. Click to switch.`}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all border ${BRAND_PILL[brandId]}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${BRAND_PILL_DOT[brandId]}`} />
            <span>{brand.label}</span>
            <span className="text-[10px] opacity-70">({BRAND_DESCRIPTOR[brandId]})</span>
          </button>
        </div>
      </div>

      {/* Right: search, fact check, export, help, create */}
      <div className="flex items-center gap-2 md:gap-3">
        {onOpenCommandPalette && (
          <button
            id="global-search-btn"
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 bg-slate-100/90 hover:bg-slate-200/80 rounded-lg border border-slate-200 transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Search studio, pillars…</span>
            <span className="md:hidden">Search</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-white text-slate-500 rounded border border-slate-300">
              <Command className="w-2.5 h-2.5" /> K
            </kbd>
          </button>
        )}

        {onOpenFactCheck && (
          <button
            id="topbar-fact-check-btn"
            type="button"
            onClick={onOpenFactCheck}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 rounded-lg border border-emerald-200 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Fact Check</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </button>
        )}

        {onOpenExport && (
          <button
            id="topbar-export-btn"
            type="button"
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}

        {onOpenHelp && (
          <button
            id="topbar-help-btn"
            type="button"
            onClick={onOpenHelp}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Editorial guidelines and help"
            aria-label="Editorial guidelines and help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}

        {onCreate && (
          <button
            id="topbar-create-btn"
            type="button"
            onClick={onCreate}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm transition-all ${BRAND_CREATE_BTN[brandId]}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Create</span>
          </button>
        )}
      </div>
    </header>
  );
}
