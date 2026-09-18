"use client";

import React from "react";
import { X } from "lucide-react";
import { useBrand } from "@/components/BrandProvider";

// Help, ported from the reference UI's HelpModal with our palette.
//
// THE COPY IS REWRITTEN, not copied. The reference's help text describes a product that
// does not exist here — it claims claims are "audited against authoritative benchmarks
// (Deloitte 2026, Kognoz GCC Restructuring Database, Gartner)". We query none of those.
// Our verify task checks claims against the live web through Claude's search, which is a
// different thing, and saying otherwise inside the product would be a false statement
// about what it does, to the people relying on it.
//
// Everything below describes what this app actually does. It is worth keeping true:
// help text nobody can trust is worse than none.

export function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const brand = useBrand();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How Social Studio works"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#43AFCD]/15 text-[#0A6E8F] flex items-center justify-center font-bold">
              ?
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Social Studio — how it works</h3>
              <p className="text-xs text-slate-500">Producing for {brand.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-center text-slate-700 font-semibold">
            PLAN → CREATE → DESIGN → VERIFY → EXPORT → POST
          </div>

          <Section title="1 · Generating, and the humanise pass">
            Studio writes decks, carousels and articles for whichever brand is selected — the rail on
            the left switches between them, and the two keep entirely separate saved data, voice
            samples and house style. Every generation runs a second pass that rewrites against real
            writing you have saved under <strong>Voice</strong>, and a linter that strips the phrases
            on your banned list.
          </Section>

          <Section title="2 · Verifying facts">
            <strong>Verify Facts</strong> checks the claims in a deck against the live web and reports
            what it could and could not confirm. It is a search, not a lookup against a licensed
            database — treat an unconfirmed claim as unconfirmed, not as false.
          </Section>

          <Section title="3 · Design families">
            {brand.name} has its own set of families, chosen per deck and held across every slide in
            it. <strong>Next look</strong> cycles the combinations of family and accent. The motif —
            petals for Kognoz, halo for Konverz — is a toggle in the Design tab.
          </Section>

          <Section title="4 · Exporting">
            A LinkedIn document PDF, a set of PNGs for a native carousel, a half-size review strip for
            sharing, and a panorama for Montage. Fonts are embedded in the file, so it renders
            correctly on a machine that does not have them installed.
          </Section>

          <Section title="5 · Keyboard">
            <span className="font-mono">⌘K</span> opens the command palette from anywhere — jump to
            any screen, switch brand, or run fact-check and export. Arrow keys move, ⏎ opens,{" "}
            <span className="font-mono">esc</span> closes.
          </Section>

          <p className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Sign-ins, content changes and downloads are recorded, including IP address and device, and
            kept for 180 days.
          </p>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">{title}</h4>
      <p>{children}</p>
    </div>
  );
}
