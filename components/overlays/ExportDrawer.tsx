"use client";

import React, { useState } from "react";
import { FileText, Image as ImageIcon, LayoutGrid, Columns, Clapperboard, ArrowRight, Check, AlertTriangle, type LucideIcon } from "lucide-react";
import { Drawer, Button, EmptyState } from "@/components/ui";

// The export drawer, ported from the reference UI — with the exports made real.
//
// The reference's version does not export anything. Its handler is:
//
//     setDownloadingFormat(id);
//     setTimeout(() => { ...setSuccessToast(`Exported ...`) }, 1000);
//
// A one-second wait and a green tick, with no file produced. That is fine in a mock; in
// this app it would be the worst possible failure, because the person walks away
// believing they have a deck to post.
//
// So every option here carries a real `run()` supplied by Studio, which owns the element
// ids, the slide dimensions and the brand font URL that lib/exportPipeline.ts needs. The
// drawer awaits it, reports what actually happened, and SHOWS THE ERROR when one throws
// rather than a success it did not earn.
//
// Two copy changes for the same reason. The reference advertises a ".zip" of carousel
// images — ours saves the PNGs individually, because that is what exportPNG does. And
// its footer claims "Target DPI: 300", which is not a property our pipeline sets; the
// export is a pixel size. Both now say what is true.

export type ExportKind = "pdf" | "png" | "strip" | "panorama" | "webm";

export interface ExportAction {
  kind: ExportKind;
  /** Runs the real export. Rejects if it fails — the drawer relies on that. */
  run: () => Promise<void>;
  /** Hidden when the current format cannot produce this, e.g. panorama outside Montage. */
  available: boolean;
  /** Overrides the default subtitle where the format changes what you get. */
  subtitle?: string;
}

const META: Record<ExportKind, { title: string; subtitle: string; icon: LucideIcon }> = {
  pdf: {
    title: "LinkedIn document",
    subtitle: "PDF · one page per slide · fonts embedded in the file",
    icon: FileText
  },
  png: {
    title: "Native image carousel",
    subtitle: "PNG · one file per slide, saved individually",
    icon: ImageIcon
  },
  strip: {
    title: "Review strip",
    subtitle: "One half-size image of the whole deck, for quick sharing",
    icon: LayoutGrid
  },
  panorama: {
    title: "Panorama",
    subtitle: "The continuous wide image, before it is sliced into frames",
    icon: Columns
  },
  webm: {
    // Named for what it is rather than "Export video": LinkedIn takes WebM but prefers
    // MP4, and somebody choosing this should know which one they are getting.
    title: "Kinetic video",
    subtitle: "WebM · the sequence as it plays · Chrome, Edge and Firefox",
    icon: Clapperboard
  }
};

export function ExportDrawer({
  isOpen,
  onClose,
  deckTitle,
  slideCount,
  actions
}: {
  isOpen: boolean;
  onClose: () => void;
  deckTitle?: string;
  slideCount?: number;
  actions: ExportAction[];
}) {
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const available = actions.filter((a) => a.available);

  async function run(action: ExportAction) {
    if (busy) return;
    setBusy(action.kind);
    setDone(null);
    setFailed(null);
    try {
      await action.run();
      setDone(`${META[action.kind].title} saved.`);
    } catch (e) {
      // The reference cannot reach this branch because it never does any work. Ours can,
      // and an export that failed must not look like one that succeeded.
      setFailed(
        `${META[action.kind].title} failed — ${e instanceof Error ? e.message : String(e)}. Nothing was saved.`
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      label="Export"
      title="Export"
      subtitle={`${deckTitle ? deckTitle : "The deck on screen"}${
        typeof slideCount === "number" ? ` · ${slideCount} slide${slideCount === 1 ? "" : "s"}` : ""
      }`}
      footer={
        <div className="text-[11px] text-slate-500 flex items-center justify-between gap-3">
          <span>Fonts are embedded, so the file renders anywhere</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="p-5 space-y-3">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          What do you need?
        </div>

        {available.length === 0 && (
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="Nothing to export yet"
            body="Generate or write a deck first, then come back here."
          />
        )}

        {available.map((action) => {
          const meta = META[action.kind];
          const Icon = meta.icon;
          const isBusy = busy === action.kind;

          return (
            <div
              key={action.kind}
              className="p-4 rounded-xl border border-slate-200 hover:border-[var(--brand-accent-soft)]/80 bg-white hover:bg-[var(--brand-accent-soft)]/5 transition-all group flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-[var(--brand-accent-soft)]/15 text-slate-700 group-hover:text-[var(--accent-deep)] flex items-center justify-center shrink-0 transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-xs text-slate-900">{meta.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                    {action.subtitle ?? meta.subtitle}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() => run(action)}
                className="shrink-0 font-semibold"
              >
                {isBusy ? (
                  <span className="text-[10px] font-mono">Rendering…</span>
                ) : (
                  <>
                    <span>Export</span>
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </Button>
            </div>
          );
        })}

        {done && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{done}</span>
          </div>
        )}

        {failed && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-px" />
            <span>{failed}</span>
          </div>
        )}
      </div>
    </Drawer>
  );
}
