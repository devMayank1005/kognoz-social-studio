// The market scan, on the page, before a month is planned from it.
//
// This panel exists because of what it prevents. The month planner used to write
// 36 topics out of the model's memory, and nobody could tell the invented
// problems from the real ones — they arrive in the same confident sentence shape.
// Putting the research on screen, with its sources, BEFORE the posts are written
// turns that into something a person can check in a minute and correct in
// another.
//
// So the list is editable and deletable rather than read-only. A scan that cannot
// be corrected is one people learn to ignore.
"use client";

import React, { useState } from "react";
import { C, FONT } from "@/lib/tokens";
import { SCAN_STALE_DAYS, scanAgeDays, type MarketProblem, type MarketScan } from "@/lib/marketScan";

interface MarketScanPanelProps {
  scan: MarketScan | null;
  busy: boolean;
  note: string;
  brandName: string;
  onScan: () => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, problem: string) => void;
}

export function MarketScanPanel({ scan, busy, note, brandName, onScan, onRemove, onEdit }: MarketScanPanelProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const problems = scan?.problems ?? [];
  const age = scanAgeDays(scan);
  const stale = age !== null && age >= SCAN_STALE_DAYS;

  const label = !problems.length
    ? "No market scan yet"
    : `${problems.length} market problem${problems.length === 1 ? "" : "s"}` +
      (age === null ? "" : age === 0 ? " · found today" : ` · ${age} day${age === 1 ? "" : "s"} old`);

  const startEdit = (p: MarketProblem) => {
    setEditing(p.id);
    setDraft(p.problem);
  };

  const commitEdit = () => {
    if (editing && draft.trim()) onEdit(editing, draft.trim());
    setEditing(null);
    setDraft("");
  };

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: "#ffffff", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: FONT,
            fontSize: 12.5,
            fontWeight: 700,
            color: C.ink,
            display: "inline-flex",
            alignItems: "center",
            gap: 7
          }}
        >
          <span style={{ color: C.inkMute, fontSize: 11 }}>{open ? "▾" : "▸"}</span>
          Market scan
          <span style={{ fontWeight: 600, color: stale ? "#9A5B13" : C.inkMute }}>{label}</span>
        </button>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={onScan}
          disabled={busy}
          title={`Search the ${brandName} market for problems its buyers actually have right now`}
          style={{
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: 7,
            border: `1px solid ${C.line}`,
            background: busy ? C.mist : "#ffffff",
            color: C.ink,
            cursor: busy ? "default" : "pointer"
          }}
        >
          {busy ? "Searching…" : problems.length ? "Refresh scan" : "Run market scan"}
        </button>
      </div>

      {/* Said once, quietly, where it is actionable rather than after the month is
          already written. A stale scan is not an error — it is last quarter's
          problems being used as this month's editorial line. */}
      {stale && problems.length > 0 && (
        <div style={{ padding: "0 14px 10px", fontSize: 11.5, color: "#9A5B13", lineHeight: 1.5 }}>
          This scan is over {SCAN_STALE_DAYS} days old. Market facts move; refresh before planning a new month.
        </div>
      )}

      {note && (
        <div style={{ padding: "0 14px 10px", fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>{note}</div>
      )}

      {open && (
        <div style={{ borderTop: `1px solid ${C.line}`, padding: "10px 14px 14px" }}>
          {!problems.length ? (
            <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, maxWidth: 560 }}>
              Nothing found yet. Without a scan the month is planned from what the model already
              believes about this market, which reads plausible and is not checkable. A scan
              searches for current, sourced problems, and you edit the list before any post is
              written from it.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11.5, color: C.inkMute, lineHeight: 1.55, marginBottom: 10, maxWidth: 620 }}>
                Every topic in a planned month comes from one of these. Delete anything that is
                wrong or not worth writing about — a shorter, truer list makes a better month than
                a long one you skimmed. These are things this app found, not things the brand
                stands behind: a figure here still has to be verified before it appears on a slide.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto" }}>
                {problems.map((p) => (
                  <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderTop: `1px solid ${C.line}`, paddingTop: 9 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editing === p.id ? (
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commitEdit}
                          rows={3}
                          autoFocus
                          style={{
                            width: "100%",
                            fontFamily: FONT,
                            fontSize: 12.5,
                            lineHeight: 1.5,
                            color: C.ink,
                            border: `1px solid ${C.lineD}`,
                            borderRadius: 6,
                            padding: "7px 9px",
                            outline: "none",
                            resize: "vertical"
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => startEdit(p)}
                          title="Click to edit"
                          style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.5, cursor: "text" }}
                        >
                          {p.problem}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: C.inkMute, marginTop: 4, lineHeight: 1.5 }}>
                        {p.who && <span>{p.who}</span>}
                        {p.who && p.lane && <span> · </span>}
                        {p.lane && <span style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{p.lane}</span>}
                      </div>
                      {p.evidence && (
                        <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 3, lineHeight: 1.5 }}>{p.evidence}</div>
                      )}
                      {/* An unsourced problem is shown as unsourced rather than
                          quietly hidden: it is the one most likely to have been
                          assumed rather than found. */}
                      <div style={{ fontSize: 11, color: p.source ? C.teal : "#9A5B13", marginTop: 3 }}>
                        {p.source ? `Source: ${p.source}` : "No source found — treat with care"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(p.id)}
                      title="Remove this problem"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: C.inkMute,
                        cursor: "pointer",
                        fontSize: 15,
                        lineHeight: 1,
                        padding: "2px 4px",
                        flexShrink: 0
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
