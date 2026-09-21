"use client";

import React, { useState } from "react";
import { User, Building, Download, Command, type LucideIcon } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { useSession } from "next-auth/react";
import { useBrandSwitch } from "@/components/BrandProvider";
import { BRAND_IDS, BRANDS } from "@/lib/brands";
import { BRAND_DESCRIPTOR, BRAND_DOT } from "@/components/shell/brandChrome";

// Workspace settings, ported from the reference UI's dual-pane modal.
//
// WITH ONE THING REMOVED: its Save button. The reference's handler is
//
//     setSaved(true); setTimeout(() => { setSaved(false); onClose(); }, 1000);
//
// — a tick and a close, saving nothing, over fields with no backend behind them. Same
// class of problem as its fake export: the person believes they changed something.
//
// So each pane here shows what is actually true. The default brand IS real and persists
// the moment you pick it (components/BrandProvider.tsx writes to localStorage and
// /api/store), which is why there is nothing to save. Everything else is read-only, and
// says so.

type TabId = "account" | "brands" | "export" | "shortcuts";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "account", label: "Account & access", icon: User },
  { id: "brands", label: "Workspace brands", icon: Building },
  { id: "export", label: "Export defaults", icon: Download },
  { id: "shortcuts", label: "Shortcuts", icon: Command }
];

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("account");
  const { data: session } = useSession();
  const { brandId, setBrandId } = useBrandSwitch();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      label="Workspace settings"
      title="Workspace settings"
      size="xl"
      bodyClassName="flex-1 flex overflow-hidden min-h-0"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">Changes here apply immediately</span>
          <Button onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div className="w-48 shrink-0 border-r border-slate-200 p-3 space-y-1 bg-slate-50/40 text-xs">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={on ? "true" : undefined}
              className={`w-full text-left p-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                on ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-600 leading-relaxed min-w-0">
        {tab === "account" && (
          <Pane title="Account & access">
            <Row label="Signed in as" value={session?.user?.name || "—"} />
            <Row label="Email" value={session?.user?.email || "—"} mono />
            <Row label="Role" value={session?.user?.isAdmin ? "Administrator" : "Editor"} />
            <Note>
              Accounts are provisioned by an administrator — there is no public signup. To add
              someone or change a role, an admin updates the workspace directly.
            </Note>
          </Pane>
        )}

        {tab === "brands" && (
          <Pane title="Workspace brands">
            <p className="mb-3">
              The brand you produce for. The two keep entirely separate calendars, house style,
              voice samples and design settings — switching never mixes them.
            </p>
            <div className="space-y-2">
              {BRAND_IDS.map((id) => {
                const on = brandId === id;
                return (
                  <button
                    key={id}
                    onClick={() => setBrandId(id)}
                    aria-pressed={on}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      on ? "border-[var(--brand-accent-soft)] bg-[var(--brand-accent-soft)]/5" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${on ? BRAND_DOT[id] : "bg-slate-300"}`} />
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-900">{BRANDS[id].name}</span>
                        <span className="block text-[11px] text-slate-500">{BRAND_DESCRIPTOR[id]}</span>
                      </span>
                    </span>
                    {on && <span className="text-[10px] font-mono text-[var(--accent-deep)] shrink-0">active</span>}
                  </button>
                );
              })}
            </div>
            <Note>Saved the moment you pick one — on this machine and to your account.</Note>
          </Pane>
        )}

        {tab === "export" && (
          <Pane title="Export defaults">
            <Row label="Slide size" value="1080 × 1350 for 4:5 formats" mono />
            <Row label="Fonts" value="Embedded in every file" />
            <Row label="PNG carousel" value="One file per slide, saved individually" />
            <Note>
              Not configurable yet. These are the values the export pipeline uses; there is no
              setting behind them, so nothing here pretends to be one.
            </Note>
          </Pane>
        )}

        {tab === "shortcuts" && (
          <Pane title="Shortcuts">
            <Shortcut keys="⌘K" what="Open the command palette from anywhere" />
            <Shortcut keys="↑ ↓" what="Move through palette results" />
            <Shortcut keys="⏎" what="Open the highlighted result" />
            <Shortcut keys="esc" what="Close the palette or any overlay" />
            <Shortcut keys="⌘Z" what="Undo in the Studio editor and the calendar item modal" />
          </Pane>
        )}
      </div>
    </Modal>
  );
}

function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`text-slate-900 font-medium text-right truncate ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Shortcut({ keys, what }: { keys: string; what: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <kbd className="px-2 py-0.5 text-[11px] font-mono bg-slate-100 text-slate-700 rounded border border-slate-200 shrink-0">
        {keys}
      </kbd>
      <span className="text-right">{what}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">{children}</p>;
}
