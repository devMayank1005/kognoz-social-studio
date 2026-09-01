"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "@/components/Logo";
import { C, FONT } from "@/lib/tokens";
import { describeActivity, describeDevice } from "@/lib/activityEvents";

// The activity timeline.
//
// Read-only by design: there is no control on this page that changes anything. An audit
// screen that can edit the audit is not an audit screen.
//
// Rows are grouped into visits by session_id, because "who was here, and what did they
// do while they were here" is the question people actually bring to a page like this.
// A flat reverse-chronological list makes you reconstruct that by eye.

interface Row {
  created_at: string;
  who: string | null;
  actor_name: string | null;
  action: string;
  entity: string | null;
  entity_label: string | null;
  screen: string | null;
  ip: string | null;
  user_agent: string | null;
  session_id: string | null;
  meta: Record<string, unknown> | null;
}

const RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" }
];

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** Colour by what kind of event it is, so a page of text is still scannable. */
function accentFor(action: string): string {
  if (action.startsWith("login") || action === "logout") return C.blue;
  if (action === "download") return "#B86B14";
  if (action === "generate") return "#7E22CE";
  if (action === "content_deleted") return "#B3261E";
  return C.teal;
}

export default function ActivityPage() {
  const { data: session, status } = useSession();

  const [rows, setRows] = useState<Row[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [who, setWho] = useState("");
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useCallback(
    (before?: string) => {
      const p = new URLSearchParams({ days: String(days), limit: "100" });
      if (who) p.set("who", who);
      if (before) p.set("before", before);
      return `/api/admin/activity?${p.toString()}`;
    },
    [days, who]
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(query())
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setRows(body.rows || []);
        setNextBefore(body.nextBefore || null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [query, status]);

  // The people filter is refreshed separately: it spans 90 days regardless of the
  // range on screen, so narrowing the dates never makes someone vanish from the list.
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/admin/activity", { method: "POST" })
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((b) => setPeople(b.people || []))
      .catch(() => setPeople([]));
  }, [status]);

  function loadMore() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    fetch(query(nextBefore))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load more"))))
      .then((body) => {
        setRows((prev) => [...prev, ...(body.rows || [])]);
        setNextBefore(body.nextBefore || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMore(false));
  }

  /**
   * Group into days, then into visits.
   *
   * A visit is one session_id. Rows without one — generations, which come from
   * api_call_log and predate this trail — are grouped by person for that day instead,
   * so they still read as a block rather than scattering.
   */
  const grouped = useMemo(() => {
    const byDay = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.created_at.slice(0, 10);
      const list = byDay.get(key);
      if (list) list.push(r);
      else byDay.set(key, [r]);
    }

    return [...byDay.entries()].map(([day, dayRows]) => {
      const visits = new Map<string, Row[]>();
      for (const r of dayRows) {
        const key = r.session_id || `${r.who || "unknown"}::no-session`;
        const list = visits.get(key);
        if (list) list.push(r);
        else visits.set(key, [r]);
      }
      return { day, visits: [...visits.values()] };
    });
  }, [rows]);

  const card: React.CSSProperties = {
    background: "#fff",
    border: `1px solid ${C.line}`,
    borderRadius: 10,
    padding: 14
  };

  const isDenied = /administrator/i.test(error);

  return (
    <main
      style={{
        padding: "24px 32px 64px",
        maxWidth: 1100,
        margin: "0 auto",
        fontFamily: FONT,
        minHeight: "100vh",
        boxSizing: "border-box"
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: `1px solid ${C.line}`,
          flexWrap: "wrap",
          gap: 12
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Logo h={34} />
          <Link
            href="/"
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: C.blue,
              textDecoration: "none",
              background: C.mist,
              padding: "7px 14px",
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <span>←</span>
            <span>Back to Studio</span>
          </Link>
        </div>

        {session?.user && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.blue,
                background: C.mist,
                padding: "5px 12px",
                borderRadius: 14
              }}
            >
              {session.user.name || session.user.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                fontFamily: FONT,
                border: `1px solid ${C.line}`,
                background: "#fff",
                color: C.inkMute,
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                padding: "5px 10px",
                cursor: "pointer"
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: "0 0 4px" }}>Activity</h1>
        <p style={{ fontSize: 13, color: C.inkMute, margin: 0, lineHeight: 1.5 }}>
          Sign-ins, content changes, generations and downloads across Kognoz Social Studio.
        </p>
      </div>

      {/* Filters */}
      <div style={{ ...card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select
          value={who}
          onChange={(e) => setWho(e.target.value)}
          style={{
            fontFamily: FONT,
            fontSize: 13,
            padding: "7px 10px",
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            background: "#fff",
            color: C.ink,
            minWidth: 220
          }}
        >
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              style={{
                fontFamily: FONT,
                fontSize: 12.5,
                fontWeight: 600,
                padding: "7px 12px",
                borderRadius: 8,
                cursor: "pointer",
                border: `1px solid ${days === r.days ? C.blue : C.line}`,
                background: days === r.days ? C.mist : "#fff",
                color: days === r.days ? C.blue : C.inkMute
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 12, color: C.inkMute, marginLeft: "auto" }}>
          {loading ? "Loading…" : `${rows.length} event${rows.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 14px",
            background: isDenied ? "#FDECEA" : "#FFF4E5",
            border: `1px solid ${isDenied ? "#F5C6C0" : "#FFD8A8"}`,
            borderRadius: 8,
            color: isDenied ? "#8C1D18" : "#9A5B13",
            fontSize: 13,
            marginBottom: 16,
            lineHeight: 1.5
          }}
        >
          {error}
          {isDenied && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Add your address to the <code>ADMIN_EMAILS</code> environment variable to get access.
            </div>
          )}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{ ...card, textAlign: "center", color: C.inkMute, fontSize: 13, padding: 32 }}>
          Nothing recorded in this period.
          <div style={{ fontSize: 12, marginTop: 6 }}>
            The trail starts when this feature was deployed — earlier activity cannot be recovered.
          </div>
        </div>
      )}

      {/* Timeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {grouped.map(({ day, visits }) => (
          <section key={day}>
            <h2
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: C.inkMute,
                margin: "0 0 10px"
              }}
            >
              {dayLabel(day + "T00:00:00")}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visits.map((visit, vi) => {
                // Rows arrive newest-first; a visit reads better oldest-first.
                const ordered = [...visit].reverse();
                const first = ordered[0];
                const ip = ordered.find((r) => r.ip)?.ip;
                const ua = ordered.find((r) => r.user_agent)?.user_agent;

                return (
                  <div key={`${day}-${vi}`} style={card}>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "baseline",
                        flexWrap: "wrap",
                        paddingBottom: 8,
                        marginBottom: 8,
                        borderBottom: `1px solid ${C.off}`
                      }}
                    >
                      <strong style={{ fontSize: 13.5, color: C.ink }}>
                        {first.actor_name || first.who || "Unknown"}
                      </strong>
                      {first.actor_name && first.who && (
                        <span style={{ fontSize: 12, color: C.inkMute }}>{first.who}</span>
                      )}
                      <span style={{ fontSize: 12, color: C.inkMute, marginLeft: "auto" }}>
                        {/* IP is the network, not the person: offices share one, phones change theirs. */}
                        {ip ? `${ip} · ` : ""}
                        {describeDevice(ua)}
                      </span>
                    </div>

                    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      {ordered.map((r, i) => (
                        <li key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 13 }}>
                          <span
                            style={{
                              fontVariantNumeric: "tabular-nums",
                              color: C.inkMute,
                              fontSize: 12,
                              minWidth: 42
                            }}
                          >
                            {time(r.created_at)}
                          </span>
                          <span
                            aria-hidden
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              background: accentFor(r.action),
                              marginTop: 5,
                              flexShrink: 0
                            }}
                          />
                          <span style={{ color: C.ink, lineHeight: 1.45 }}>{describeActivity(r)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {nextBefore && !error && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          style={{
            marginTop: 20,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            padding: "9px 18px",
            borderRadius: 8,
            border: `1px solid ${C.line}`,
            background: "#fff",
            color: C.blue,
            cursor: loadingMore ? "default" : "pointer"
          }}
        >
          {loadingMore ? "Loading…" : "Load older activity"}
        </button>
      )}

      <p style={{ fontSize: 11.5, color: C.inkMute, marginTop: 28, lineHeight: 1.6 }}>
        Downloads are the closest thing to publishing this tool records — it does not post to LinkedIn or
        Instagram, so “Posted” is a status somebody set by hand. IP addresses are retained for 180 days.
      </p>
    </main>
  );
}
