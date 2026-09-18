"use client";

import React, { useState } from "react";
import { X, FileText, Image as ImageIcon, LayoutGrid, Columns, ArrowRight, Check, AlertTriangle, type LucideIcon } from "lucide-react";

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

export type ExportKind = "pdf" | "png" | "strip" | "panorama";

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

  if (!isOpen) return null;

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
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between"
      >
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-slate-900">Export</h3>
            <p className="text-xs text-slate-500 truncate">
              {deckTitle ? deckTitle : "The deck on screen"}
              {typeof slideCount === "number" ? ` · ${slideCount} slide${slideCount === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            What do you need?
          </div>

          {available.length === 0 && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 leading-relaxed">
              Nothing to export yet — generate or write a deck first.
            </div>
          )}

          {available.map((action) => {
            const meta = META[action.kind];
            const Icon = meta.icon;
            const isBusy = busy === action.kind;

            return (
              <div
                key={action.kind}
                className="p-4 rounded-xl border border-slate-200 hover:border-[#43AFCD]/80 bg-white hover:bg-[#43AFCD]/5 transition-all group flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-[#43AFCD]/15 text-slate-700 group-hover:text-[#0A6E8F] flex items-center justify-center shrink-0 transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-xs text-slate-900">{meta.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      {action.subtitle ?? meta.subtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run(action)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-[#005184] disabled:opacity-50 disabled:hover:bg-slate-900 text-white transition-all flex items-center gap-1"
                >
                  {isBusy ? (
                    <span className="text-[10px] font-mono">Rendering…</span>
                  ) : (
                    <>
                      <span>Export</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
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

        <div className="p-4 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Fonts are embedded, so the file renders anywhere</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
