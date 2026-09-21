"use client";

import React from "react";
import { useBrand } from "@/components/BrandProvider";
import { Modal, Button } from "@/components/ui";

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      label="How Social Studio works"
      title="Social Studio — how it works"
      subtitle={`Producing for ${brand.name}`}
      icon="?"
      size="lg"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Got it</Button>
        </div>
      }
    >
      <div className="p-6 space-y-5 text-xs text-slate-600 leading-relaxed">
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
    </Modal>
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
