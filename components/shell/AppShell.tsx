"use client";

import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, SIDEBAR_WIDTH, SIDEBAR_WIDTH_COLLAPSED, type SidebarCounts } from "./Sidebar";
import { Topbar, TOPBAR_HEIGHT } from "./Topbar";
import { CommandPalette } from "@/components/overlays/CommandPalette";
import { HelpModal } from "@/components/overlays/HelpModal";
import { SettingsModal } from "@/components/overlays/SettingsModal";

// The chrome every signed-in screen sits inside, ported from the reference's App.tsx
// layout shell.
//
// Two structural notes carried over from the reference, both load-bearing:
//
//   h-screen + overflow-hidden on the frame, and the scroll living on the inner <main>.
//   Studio's filmstrip and the calendar grid are long; letting the document scroll would
//   take the rail and the topbar with it.
//
//   The rail is duplicated for mobile as a drawer rather than being made responsive.
//   On a phone it is either a sheet or it is absent; there is no room for anything else.
//
// On desktop the rail DOES have a useful narrow state, contrary to what this comment used
// to claim: at 64px the icons stay reachable and the canvas gains 168px, which is the
// difference between a 1080-wide slide fitting comfortably and not. The choice persists in
// localStorage and is applied in a layout effect — after hydration, before paint — so the
// rail never flashes open on the way to being closed. components/BrandProvider.tsx explains
// that pattern at length; Studio's own collapse uses a plain effect and does flash.
//
// Wrapping each PAGE rather than the root layout is deliberate: /login must not get a
// sidebar, and a root-level shell would have to special-case it by pathname.

export function AppShell({
  children,
  counts,
  onOpenCommandPalette,
  onOpenHelp,
  onOpenFactCheck,
  onOpenExport,
  onOpenSettings,
  onCreate
}: {
  children: React.ReactNode;
  counts?: SidebarCounts;
  onOpenCommandPalette?: () => void;
  onOpenHelp?: () => void;
  onOpenFactCheck?: () => void;
  onOpenExport?: () => void;
  onOpenSettings?: () => void;
  onCreate?: () => void;
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // The stored rail width, applied before the browser paints so there is no visible jump.
  // useLayoutEffect warns during SSR, where it would do nothing anyway.
  const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
  useIsomorphicLayoutEffect(() => {
    try {
      if (window.localStorage.getItem(SHELL_COLLAPSED_KEY) === "true") setCollapsed(true);
    } catch {
      /* private mode, or storage disabled. Expanded is a fine answer. */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SHELL_COLLAPSED_KEY, String(next));
      } catch {
        /* the choice just will not survive a reload */
      }
      return next;
    });
  }, []);

  // ⌘K from anywhere. The palette owns Escape and a second ⌘K to close; this listener
  // only opens, so the two cannot fight over the same event.
  //
  // It does not collide with the ⌘Z undo in Studio.tsx or ContentEditorModal.tsx —
  // different key — and it deliberately does NOT bail out while a field has focus,
  // because ⌘K from inside the topic box should still open the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Search, Help and + Create are app-level and always present, exactly as the
  // reference renders them — a topbar that blanks half its controls depending on the
  // page reads as broken rather than as contextual. Fact Check and Export stay
  // page-supplied, because they act on a deck that only Studio has.
  //
  // The overlays these open are not built yet. Until they are, each falls back to
  // something honest rather than a dead button.
  const openPalette = onOpenCommandPalette ?? (() => setPaletteOpen(true));
  const openHelp = onOpenHelp ?? (() => setHelpOpen(true));
  const create = onCreate ?? (() => router.push("/studio"));
  const openSettings = onOpenSettings ?? (() => setSettingsOpen(true));

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ background: "var(--surface-app)", color: "var(--color-ink)", fontFamily: "var(--font-ui)" }}
    >
      <div className="hidden md:block shrink-0">
        <Sidebar
          counts={counts}
          onOpenSettings={openSettings}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="relative z-10 h-full shadow-2xl" style={{ width: SIDEBAR_WIDTH }}>
            <Sidebar
              counts={counts}
              onOpenSettings={() => {
                setMobileOpen(false);
                // `openSettings`, not the raw prop. No page passes onOpenSettings, so the
                // optional call was always a no-op: on a phone the drawer closed and nothing
                // opened, while the same button worked on desktop, which uses the fallback.
                openSettings();
              }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topbar
          onOpenCommandPalette={openPalette}
          onOpenHelp={openHelp}
          onOpenFactCheck={onOpenFactCheck}
          onOpenExport={onOpenExport}
          onCreate={create}
          onToggleMobileMenu={() => setMobileOpen((v) => !v)}
        />

        <main className="flex-1 flex flex-col overflow-hidden min-h-0 relative">{children}</main>
      </div>

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onFactCheck={onOpenFactCheck}
        onExport={onOpenExport}
      />

      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/** Where the rail width is remembered. A literal, like every other key in this app. */
const SHELL_COLLAPSED_KEY = "kognoz-shell-collapsed";

export { SIDEBAR_WIDTH, SIDEBAR_WIDTH_COLLAPSED, TOPBAR_HEIGHT };
