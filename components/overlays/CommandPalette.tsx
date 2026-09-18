"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Sparkles, Calendar, FileText, FolderKanban, FileCode, Mic, Palette, Activity, ShieldCheck, Download, Building, type LucideIcon } from "lucide-react";
import { useBrandSwitch } from "@/components/BrandProvider";
import { buildCommands, filterCommands, moveSelection, clampSelection, type Command } from "@/lib/commandPalette";
import type { NavId } from "@/lib/navigation";

// The ⌘K palette, ported from the reference UI with our palette.
//
// Two things the reference does not do, added here:
//
//   Arrow keys actually work. Its footer reads "Navigate with arrows or mouse" but no
//   key handler exists — the claim is simply untrue in the running app. A palette whose
//   whole point is the keyboard should honour that, so ↑ ↓ ⏎ are wired.
//
//   The list is derived, not hardcoded. Its commands are a second copy of the nav, which
//   is how it ended up advertising "24 Planned Items" out of mock data and offering
//   admin screens to everyone. Ours comes from lib/navigation.ts through
//   lib/commandPalette.ts, so it inherits the admin gate for free.

const ICONS: Record<NavId, LucideIcon> = {
  studio: Sparkles,
  calendar: Calendar,
  articles: FileText,
  assets: FolderKanban,
  style: FileCode,
  voice: Mic,
  design: Palette,
  audit: Activity,
  settings: Building
};

function iconFor(c: Command): LucideIcon {
  if (c.kind === "brand") return Building;
  if (c.actionId === "fact-check") return ShieldCheck;
  if (c.actionId === "export") return Download;
  return (c.navId && ICONS[c.navId]) || Sparkles;
}

export function CommandPalette({
  isOpen,
  onClose,
  onFactCheck,
  onExport
}: {
  isOpen: boolean;
  onClose: () => void;
  onFactCheck?: () => void;
  onExport?: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { brandId, setBrandId } = useBrandSwitch();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const commands = useMemo(
    () =>
      buildCommands({
        isAdmin: session?.user?.isAdmin,
        currentBrand: brandId,
        canFactCheck: Boolean(onFactCheck),
        canExport: Boolean(onExport)
      }),
    [session?.user?.isAdmin, brandId, onFactCheck, onExport]
  );

  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  // Typing narrows the list; the highlight must not be left pointing past the end.
  useEffect(() => {
    setSelected((s) => clampSelection(s, results.length));
  }, [results.length]);

  // Reopening should not resume someone else's half-typed query.
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelected(0);
    }
  }, [isOpen]);

  function run(c: Command | undefined) {
    if (!c) return;
    onClose();
    if (c.kind === "navigate" && c.href) router.push(c.href);
    else if (c.kind === "brand" && c.brandId) setBrandId(c.brandId);
    else if (c.actionId === "fact-check") onFactCheck?.();
    else if (c.actionId === "export") onExport?.();
  }

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => moveSelection(s, e.key === "ArrowDown" ? 1 : -1, results.length));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        run(results[selected]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run/onClose are stable enough here
  }, [isOpen, results, selected, onClose]);

  // Keep the highlighted row on screen when walking a long list by keyboard.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[70vh]"
      >
        <div className="p-3.5 border-b border-slate-200 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search views, or switch brand…"
            aria-label="Search commands"
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-500 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
          {results.length === 0 ? (
            <div className="p-6 text-center text-slate-400">No matching commands or destinations.</div>
          ) : (
            results.map((c, i) => {
              const Icon = iconFor(c);
              const on = i === selected;
              return (
                <button
                  key={c.id}
                  data-selected={on}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => run(c)}
                  className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-colors group ${
                    on ? "bg-slate-100" : "hover:bg-slate-100/90"
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        on ? "bg-[#43AFCD]/15 text-[#0A6E8F]" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-medium text-slate-800 truncate">{c.title}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 shrink-0">
                    {c.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="p-2.5 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-between">
          <span>↑ ↓ to move · ⏎ to open · esc to close</span>
          <span className="font-mono">
            {results.length} of {commands.length}
          </span>
        </div>
      </div>
    </div>
  );
}
