"use client";

import React from "react";
import { ShieldCheck, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { coerceClaims, summarise, sortClaims, summaryLine, type Verdict } from "@/lib/verifyClaims";

// Fact verification, ported from the reference UI's VerifyFactsModal — over our real
// `verify` task instead of its MOCK_FACT_CLAIMS.
//
// The design decision this screen turns on: **unverifiable is rendered differently from
// wrong.** "We could not confirm this" and "this is false" are different claims about
// the world, and a single red ✗ for both makes someone delete a true sentence because a
// search came back thin. Three states, three colours, counted separately in the header.
//
// Applying corrections rewrites the deck, so it is a deliberate second click — and
// Studio snapshots first, which is what makes the undo in its header work afterwards.

const STYLE: Record<Verdict, { label: string; icon: typeof ShieldCheck; chip: string; ring: string }> = {
  wrong: {
    label: "Contradicted",
    icon: AlertTriangle,
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    ring: "border-amber-200"
  },
  unverifiable: {
    // Neutral on purpose. Nothing is wrong here, and colouring it like a problem would
    // push people to "fix" claims that may be perfectly true.
    label: "Not confirmed",
    icon: HelpCircle,
    chip: "bg-slate-100 text-slate-600 border-slate-200",
    ring: "border-slate-200"
  },
  verified: {
    label: "Confirmed",
    icon: ShieldCheck,
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ring: "border-emerald-200"
  }
};

export function VerifyFactsModal({
  isOpen,
  onClose,
  checks,
  busy,
  error,
  canApply,
  onRun,
  onApply
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Raw `checks` from the verify task — coerced here, never trusted. */
  checks: unknown;
  busy?: boolean;
  error?: string;
  /** True when the task returned a corrected deck to apply. */
  canApply?: boolean;
  onRun?: () => void;
  onApply?: () => void;
}) {
  const claims = sortClaims(coerceClaims(checks));
  const summary = summarise(claims);
  const hasRun = claims.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      label="Fact verification"
      title="Fact verification"
      subtitle={
        busy
          ? "Searching the live web…"
          : hasRun
            ? summaryLine(summary)
            : "Checks every claim in this deck against the live web."
      }
      icon={<ShieldCheck className="w-4 h-4" />}
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400 leading-snug">
            {summary.unverifiable > 0
              ? "Not confirmed is not the same as false — check those yourself before cutting them."
              : "Applying rewrites the deck. You can undo it afterwards."}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            {onRun && (
              <Button variant="secondary" onClick={onRun} disabled={busy}>
                {hasRun ? "Check again" : "Run check"}
              </Button>
            )}
            {canApply && onApply && (
              <Button
                onClick={() => {
                  onApply();
                  onClose();
                }}
              >
                Apply corrections
              </Button>
            )}
          </div>
        </div>
      }
    >
      {hasRun && (
        <div className="sticky top-0 z-10 bg-white px-5 py-3 border-b border-slate-100 flex items-center gap-2 text-[11px] flex-wrap">
          <Tally kind="wrong" n={summary.wrong} />
          <Tally kind="unverifiable" n={summary.unverifiable} />
          <Tally kind="verified" n={summary.verified} />
        </div>
      )}

      <div className="p-5 space-y-3">
        {error && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed">
            {error}
          </div>
        )}

        {busy && (
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Reading sources. A grounded check costs several times a plain call, so this runs once.</span>
          </div>
        )}

        {!busy && !hasRun && !error && (
          <div className="p-6 text-center text-xs text-slate-500 leading-relaxed">
            Nothing checked yet.
            <div className="mt-2 text-slate-400">
              A grounded search costs several times a normal generation, so it runs only when you ask.
            </div>
          </div>
        )}

        {!busy &&
          claims.map((c, i) => {
            const s = STYLE[c.verdict];
            const Icon = s.icon;
            return (
              <div key={`${c.where}-${i}`} className={`p-4 rounded-xl border bg-white ${s.ring}`}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${s.chip}`}>
                    <Icon className="w-3 h-3" />
                    {s.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{c.where}</span>
                </div>

                <p className="text-xs text-slate-900 font-medium leading-relaxed">{c.claim}</p>

                {c.note && <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">{c.note}</p>}

                {c.realSource && (
                  <p className="text-[10px] font-mono text-slate-400 mt-2 truncate" title={c.realSource}>
                    {c.realSource}
                  </p>
                )}
              </div>
            );
          })}
      </div>
    </Modal>
  );
}

function Tally({ kind, n }: { kind: Verdict; n: number }) {
  if (!n) return null;
  const s = STYLE[kind];
  return (
    <span className={`px-2 py-0.5 rounded-full border font-mono tabular-nums ${s.chip}`}>
      {n} {s.label.toLowerCase()}
    </span>
  );
}
