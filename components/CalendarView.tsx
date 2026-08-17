"use client";

// Calendar — PRD §11. Real 36-item plan, shared via Supabase, status
// tap-cycle wired. Create-> (Studio formats) and Write-> (Text post/Poll)
// are wired here: Create links to Studio with the item's format/pillar/set/
// style as query params (Studio auto-generates on mount, see components/
// Studio.tsx's searchParams effect); Write generates the caption inline
// using the same buildCaptionPrompt the Studio's writeCopy() would use.

import { useEffect, useState } from "react";
import {
  PLAN_TEMPLATE,
  TMPL_V,
  WEEK_OF,
  STATUS_NEXT,
  STATUS_COLOR,
  CHANNELS,
  type Plan,
  type ItemStatus,
  type PlanItem
} from "@/lib/calendarTemplate";
import { STUDIO_FORMATS } from "@/lib/formats";
import { buildCaptionPrompt } from "@/lib/promptBuilders";
import { callClaudeText, FAST_MODEL } from "@/lib/claudeClient";

function freshPlan(): Plan {
  return {
    month: 1,
    tmplV: TMPL_V,
    history: [],
    items: PLAN_TEMPLATE.map((it) => ({ ...it, status: "Planned" as ItemStatus }))
  };
}

const CALENDAR_ONLY = new Set(["Text post", "Poll"]);

function createHref(it: PlanItem): string {
  const p = new URLSearchParams({ topic: it.topic, format: it.fmt, pillar: it.pillar, n: String(it.n) });
  if (it.set) p.set("set", it.set);
  if (it.style) p.set("style", it.style);
  return `/?${p.toString()}`;
}

export default function CalendarView() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingN, setSavingN] = useState<number | null>(null);
  const [openN, setOpenN] = useState<number | null>(null);
  const [writingN, setWritingN] = useState<number | null>(null);
  const [instrByN, setInstrByN] = useState<Record<number, string>>({});
  const [copiedN, setCopiedN] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/store?key=kognoz-calendar");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        const saved = data?.value as Partial<Plan> | undefined;
        if (saved && Array.isArray(saved.items) && saved.items.length) {
          if (saved.tmplV !== TMPL_V) {
            const statusByN: Record<number, ItemStatus> = {};
            saved.items.forEach((it) => {
              if (typeof it.n === "number" && it.status) statusByN[it.n] = it.status as ItemStatus;
            });
            setPlan({
              month: saved.month ?? 1,
              tmplV: TMPL_V,
              history: saved.history ?? [],
              items: PLAN_TEMPLATE.map((t) => ({ ...t, status: statusByN[t.n] ?? "Planned" }))
            });
          } else {
            setPlan(saved as Plan);
          }
        } else {
          setPlan(freshPlan());
        }
      } catch (e) {
        setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        setPlan(freshPlan());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function persist(next: Plan) {
    try {
      const res = await fetch("/api/store?key=kognoz-calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? `${e.name}: ${e.message} — not saved` : String(e));
      return false;
    }
  }

  async function cycleStatus(n: number) {
    if (!plan || savingN !== null) return;
    setSavingN(n);
    const next: Plan = { ...plan, items: plan.items.map((it) => (it.n === n ? { ...it, status: STATUS_NEXT[it.status] } : it)) };
    setPlan(next);
    if (!(await persist(next))) setPlan(plan);
    setSavingN(null);
  }

  async function updateCopy(n: number, copy: string) {
    if (!plan) return;
    const next: Plan = { ...plan, items: plan.items.map((it) => (it.n === n ? { ...it, copy } : it)) };
    setPlan(next);
    await persist(next);
  }

  async function writeCopy(it: PlanItem & { status: ItemStatus }, instruction?: string) {
    if (writingN !== null) return;
    setWritingN(it.n);
    setError("");
    try {
      const prompt = buildCaptionPrompt({ channel: it.ch, fmt: it.fmt, topic: it.topic, currentCopy: it.copy, instruction });
      const text = await callClaudeText("caption", prompt, instruction ? { model: FAST_MODEL } : undefined);
      await updateCopy(it.n, text.trim());
      setInstrByN((m) => ({ ...m, [it.n]: "" }));
    } catch (e) {
      setError(e instanceof Error ? `Write failed: ${e.message}` : String(e));
    } finally {
      setWritingN(null);
    }
  }

  async function copyText(it: PlanItem) {
    try {
      await navigator.clipboard.writeText(it.copy || "");
      setCopiedN(it.n);
      setTimeout(() => setCopiedN(null), 1500);
    } catch {
      /* clipboard permission denied — Copy button just won't confirm */
    }
  }

  if (loading) return <p>Loading calendar…</p>;
  if (!plan) return null;

  const weeks = Array.from(new Set(plan.items.map((it) => WEEK_OF(it.day))));

  return (
    <div>
      {error && <p style={{ color: "#B3261E", fontSize: 13 }}>{error}</p>}
      <p style={{ color: "var(--color-ink-soft)", fontSize: 14 }}>
        Month {plan.month} · {plan.items.filter((i) => i.status === "Posted").length}/{plan.items.length} posted
      </p>
      {weeks.map((week) => (
        <section key={week} style={{ marginTop: 28 }}>
          <h2 className="display" style={{ fontSize: 16, color: "var(--color-ink-mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {week}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {plan.items
              .filter((it) => WEEK_OF(it.day) === week)
              .map((it) => {
                const isOpen = openN === it.n;
                const isStudioFmt = (STUDIO_FORMATS as readonly string[]).includes(it.fmt);
                const isCalendarOnly = CALENDAR_ONLY.has(it.fmt);
                return (
                  <div key={it.n} style={{ background: "#fff", border: "1px solid var(--color-line)", borderRadius: 6, fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
                      <span style={{ color: "var(--color-ink-mute)", width: 24 }}>#{it.n}</span>
                      <span style={{ background: CHANNELS[it.ch] ?? "#999", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{it.ch}</span>
                      <span style={{ flexShrink: 0, width: 100, color: "var(--color-ink-soft)" }}>{it.fmt}</span>
                      <span
                        onClick={() => setOpenN(isOpen ? null : it.n)}
                        style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                        title="Click to expand the post"
                      >
                        {it.topic}
                      </span>
                      {isStudioFmt && (
                        <a
                          href={createHref(it)}
                          style={{ fontSize: 11, fontWeight: 700, color: "var(--color-blue, #005184)", textDecoration: "none", flexShrink: 0 }}
                        >
                          Create →
                        </a>
                      )}
                      <button
                        onClick={() => cycleStatus(it.n)}
                        disabled={savingN !== null}
                        style={{
                          background: STATUS_COLOR[it.status],
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          padding: "3px 10px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: savingN !== null ? "default" : "pointer",
                          flexShrink: 0
                        }}
                      >
                        {it.status}
                      </button>
                    </div>
                    {isOpen && (
                      <div style={{ padding: "0 12px 12px", borderTop: "1px solid var(--color-line)" }}>
                        <p style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 10 }}>{it.copy}</p>
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          <button onClick={() => copyText(it)} style={smallBtnStyle}>
                            {copiedN === it.n ? "Copied" : "Copy text"}
                          </button>
                          {isCalendarOnly && (
                            <button onClick={() => writeCopy(it)} disabled={writingN !== null} style={smallBtnStyle}>
                              {writingN === it.n ? "Writing…" : "Rewrite"}
                            </button>
                          )}
                        </div>
                        {isCalendarOnly && (
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <input
                              value={instrByN[it.n] || ""}
                              onChange={(e) => setInstrByN((m) => ({ ...m, [it.n]: e.target.value }))}
                              placeholder="Revise: e.g. shorter, sharper hook, add a question"
                              style={{ flex: 1, fontSize: 12.5, padding: "8px 10px", border: "1px solid var(--color-line)", borderRadius: 6 }}
                            />
                            <button
                              onClick={() => writeCopy(it, instrByN[it.n])}
                              disabled={writingN !== null || !(instrByN[it.n] || "").trim()}
                              style={smallBtnStyle}
                            >
                              ↻
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
  border: "1.5px solid #005184",
  color: "#005184",
  background: "transparent"
};
