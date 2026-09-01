// Reporting what the user just did, from the browser.
//
// Three properties this must have, because it runs alongside real work:
//
//   never throws      An unhandled rejection here would surface as a console error on
//                     an action that actually succeeded.
//   never awaited     UI code calls this and moves on. Nothing waits on the network.
//   keepalive         Sign-out and tab close would otherwise cancel the request
//                     mid-flight and lose the last event of every visit.
//
// The browser only ever says WHAT happened. Who did it and where from are filled in
// server-side from the session cookie and the request headers — see
// app/api/activity/route.ts. That is why `login` is not something this can send.

import type { Action } from "@/lib/activityEvents";

export interface LogOptions {
  entity?: string;
  entityId?: string;
  entityLabel?: string;
  screen?: "login" | "studio" | "calendar" | "admin";
  meta?: Record<string, unknown>;
  /** Groups this event into a sign-in. Read from `session.user.sid`. */
  sessionId?: string;
}

/** The sid for this page, set once the session is known. */
let currentSessionId: string | undefined;

/**
 * Tell the logger which sign-in the page belongs to.
 *
 * A module-level value rather than a parameter on every call: the alternative was
 * threading `session.user.sid` through the export pipeline, which has no business
 * knowing about sessions.
 */
export function setActivitySession(sid: string | undefined): void {
  currentSessionId = sid;
}

/** Report one action. Fire-and-forget; the returned promise never rejects. */
export function logActivity(action: Action, opts: LogOptions = {}): void {
  if (typeof window === "undefined") return;

  try {
    void fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        entity: opts.entity,
        entityId: opts.entityId,
        entityLabel: opts.entityLabel,
        screen: opts.screen,
        meta: opts.meta,
        sessionId: opts.sessionId ?? currentSessionId
      }),
      // Survives the page going away, which is the only way a logout or a close
      // ever gets recorded.
      keepalive: true
    }).catch(() => {
      // Deliberately silent. A failed audit write is a server-side problem and the
      // user did nothing wrong; a console error here would suggest otherwise.
    });
  } catch {
    // fetch itself can throw synchronously on a malformed body. Same reasoning.
  }
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

/**
 * Downloads arrive in bursts.
 *
 * Exporting a 5-slide carousel calls saveBlobAs five times in under a second. Five
 * rows would say "downloaded five times", which reads as five separate decisions —
 * it was one click. Collect a burst and report it as one event with a count.
 */
const BURST_MS = 1500;

let burst: { names: string[]; timer: ReturnType<typeof setTimeout> } | null = null;

/** The shared stem of a burst — "kognoz-carousel" out of "kognoz-carousel-1.png". */
export function commonLabel(names: string[]): string {
  if (!names.length) return "";
  if (names.length === 1) return names[0];

  const [first, ...rest] = names;
  let end = first.length;
  for (const name of rest) {
    let i = 0;
    while (i < end && i < name.length && first[i] === name[i]) i++;
    end = i;
  }
  // Trim the separator a truncated stem tends to end on, so "kognoz-deck-" reads as
  // "kognoz-deck". Fall back to the first full name if there is no shared stem.
  const stem = first.slice(0, end).replace(/[-_\s.]+$/, "");
  return stem || first;
}

/** The extensions in a burst, for the meta — "png", or "png, pdf" for a mixed export. */
export function extensionsOf(names: string[]): string {
  const seen: string[] = [];
  for (const n of names) {
    const m = /\.([a-z0-9]+)$/i.exec(n);
    const ext = m ? m[1].toLowerCase() : "";
    if (ext && !seen.includes(ext)) seen.push(ext);
  }
  return seen.join(", ");
}

/**
 * Record a download, coalescing anything that follows within BURST_MS.
 *
 * Called from `saveBlobAs` in lib/exportPipeline.ts, which every export path in the
 * app funnels through — so this one call covers PNG, PDF, panorama, strip, frames and
 * the article markdown.
 */
export function logDownload(filename: string): void {
  if (typeof window === "undefined") return;

  if (burst) {
    burst.names.push(filename);
    clearTimeout(burst.timer);
  } else {
    burst = { names: [filename], timer: undefined as never };
  }

  const flush = () => {
    const names = burst?.names ?? [];
    burst = null;
    if (!names.length) return;
    logActivity("download", {
      entity: "export",
      entityLabel: commonLabel(names),
      screen: "studio",
      meta: { count: names.length, formats: extensionsOf(names), files: names.slice(0, 10) }
    });
  };

  burst.timer = setTimeout(flush, BURST_MS);
}

/** Test seam: drop any pending burst so one test cannot leak into the next. */
export function resetDownloadBurst(): void {
  if (burst) clearTimeout(burst.timer);
  burst = null;
}
