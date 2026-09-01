// The activity trail's vocabulary and its rules.
//
// Pure and I/O-free, like lib/coerce.ts and lib/calendarPlan.ts, so the parts that
// decide what is allowed and what a row means can be tested without a database or a
// browser.
//
// Two rules here are security, not tidiness:
//
//   CLIENT_ACTIONS  A browser may only send the actions in this list. `login` is not
//                   in it. If the client could post its own login events, the trail
//                   would record sign-ins that never happened — which is worse than
//                   having no trail, because it looks authoritative.
//   clampMeta       `meta` is free-form JSON from the client. Unbounded, it is a
//                   cheap way to fill the table.
//
// Identity and IP are never taken from the client at all; see app/api/activity/route.ts.

/** Everything that can appear in the trail, including rows the view synthesises. */
export const ACTIONS = [
  // Session — recorded server-side from NextAuth, never accepted from a browser.
  "login",
  "logout",
  "login_failed",
  "login_blocked",

  // Content — the calendar.
  "content_created",
  "content_edited",
  "content_deleted",
  "content_status_changed",
  "month_generated",

  // Export. The closest thing this app has to publishing: there is no LinkedIn or
  // Instagram integration, so a download is the moment something leaves the tool.
  "download",

  // Synthesised by v_all_activity from api_call_log — never inserted directly.
  "generate"
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * The actions a browser is allowed to report.
 *
 * Everything a user does in the UI that we care about, and nothing about sessions:
 * those are recorded on the server where the evidence actually is.
 */
export const CLIENT_ACTIONS: readonly Action[] = [
  "content_created",
  "content_edited",
  "content_deleted",
  "content_status_changed",
  "month_generated",
  "download"
];

export function isClientAction(value: unknown): value is Action {
  return typeof value === "string" && (CLIENT_ACTIONS as readonly string[]).includes(value);
}

/** Screens, for the "where were they" column. Free text is coerced onto these. */
export const SCREENS = ["login", "studio", "calendar", "admin", "unknown"] as const;
export type Screen = (typeof SCREENS)[number];

export function toScreen(value: unknown): Screen {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (SCREENS as readonly string[]).includes(v) ? (v as Screen) : "unknown";
}

// ---------------------------------------------------------------------------
// Where the request came from
// ---------------------------------------------------------------------------

/** Just enough of Headers to read one value, so tests can pass a plain object. */
export interface HeaderLike {
  get(name: string): string | null;
}

const LOOPBACK = new Set(["::1", "127.0.0.1", "::ffff:127.0.0.1", "0:0:0:0:0:0:0:1"]);

/**
 * Strip an IPv6 zone, an IPv4 port, and the IPv4-mapped-IPv6 prefix.
 *
 * `::ffff:14.96.50.18` and `14.96.50.18` are the same address and must not appear
 * as two different people in the timeline. A bare IPv6 address is left alone —
 * splitting it on ":" would destroy it.
 */
function normaliseIp(raw: string): string {
  let ip = raw.trim().replace(/^\[|\]$/g, "");
  if (!ip) return "";

  const zone = ip.indexOf("%");
  if (zone !== -1) ip = ip.slice(0, zone);

  if (/^::ffff:\d{1,3}(\.\d{1,3}){3}$/i.test(ip)) ip = ip.slice(7);

  // Only an IPv4 address can carry a ":port" — in IPv6 the colons are the address.
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.indexOf(":"));

  return LOOPBACK.has(ip.toLowerCase()) ? "local" : ip;
}

/**
 * The client's IP, as best the platform can tell us.
 *
 * `x-forwarded-for` is a chain — client, then each proxy that handled it. On Vercel
 * the real client is the FIRST entry; taking the last would record Vercel's own edge
 * address for every user, which looks plausible and is entirely useless.
 *
 * Returns "" when nothing is available rather than a guess, so the column reads as
 * unknown instead of wrong.
 */
export function clientIp(headers: HeaderLike): string {
  const forwarded = headers.get("x-forwarded-for") || headers.get("x-vercel-forwarded-for");
  if (forwarded) {
    for (const part of forwarded.split(",")) {
      const ip = normaliseIp(part);
      if (ip) return ip;
    }
  }
  return normaliseIp(headers.get("x-real-ip") || "");
}

/** A short, readable device description. The full UA string is stored separately. */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = (userAgent || "").trim();
  if (!ua) return "Unknown device";

  const os = /iPhone|iPad/i.test(ua)
    ? "iOS"
    : /Android/i.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/i.test(ua)
        ? "Mac"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Linux/i.test(ua)
            ? "Linux"
            : "";

  // Order matters: Edge and Chrome both claim "Chrome", Chrome and Safari both
  // claim "Safari". Most specific first.
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Firefox\//i.test(ua)
          ? "Firefox"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "";

  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(" on ") : "Unknown device";
}

// ---------------------------------------------------------------------------
// meta
// ---------------------------------------------------------------------------

const META_MAX_KEYS = 12;
const META_MAX_STRING = 200;
const META_MAX_DEPTH = 2;
const META_MAX_ARRAY = 20;

/**
 * Make client-supplied `meta` safe to store.
 *
 * Bounded in every direction that could be abused — key count, string length, array
 * length, nesting depth — and stripped of anything jsonb cannot hold. Returns null
 * rather than an empty object so the column stays honestly empty.
 */
export function clampMeta(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const out: Record<string, unknown> = {};
  let kept = 0;

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (kept >= META_MAX_KEYS) break;
    const clean = clampValue(raw, depth + 1);
    if (clean === undefined) continue;
    out[key.slice(0, 60)] = clean;
    kept++;
  }

  return kept ? out : null;
}

function clampValue(raw: unknown, depth: number): unknown {
  if (raw === null) return null;

  switch (typeof raw) {
    case "string":
      return raw.slice(0, META_MAX_STRING);
    case "boolean":
      return raw;
    case "number":
      // NaN and Infinity are not valid JSON and would be stored as null anyway.
      return Number.isFinite(raw) ? raw : undefined;
    case "object":
      break;
    default:
      // functions, symbols, undefined
      return undefined;
  }

  if (depth > META_MAX_DEPTH) return undefined;

  if (Array.isArray(raw)) {
    const arr = raw.slice(0, META_MAX_ARRAY).map((v) => clampValue(v, depth + 1)).filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }

  return clampMeta(raw, depth) ?? undefined;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface ActivityRow {
  action: string;
  entity?: string | null;
  entity_label?: string | null;
  meta?: Record<string, unknown> | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * One row as a sentence.
 *
 * The single place activity wording lives, so the admin screen cannot drift from
 * what the events actually mean — and so the wording itself can be tested.
 */
export function describeActivity(row: ActivityRow): string {
  const label = text(row.entity_label);
  const meta = row.meta || {};
  const quoted = label ? ` “${label}”` : "";

  switch (row.action) {
    case "login": {
      const via = text(meta.provider) === "azure-ad" ? "Microsoft" : "password";
      return `Signed in with ${via}`;
    }
    case "logout":
      return "Signed out";
    case "login_failed":
      return `Failed sign-in${label ? ` as ${label}` : ""}`;
    case "login_blocked":
      return `Sign-in blocked — ${label || "address outside the allowed domains"}`;

    case "content_created":
      return `Created${quoted}`;
    case "content_edited":
      return `Edited${quoted}`;
    case "content_deleted":
      return `Deleted${quoted}`;
    case "content_status_changed": {
      const to = text(meta.to);
      // "Posted" is a status somebody flipped by hand — the app publishes nowhere.
      return to ? `Marked${quoted} ${to}` : `Changed the status of${quoted}`;
    }
    case "month_generated": {
      const count = num(meta.count);
      return `Generated a month of content${count !== null ? ` — ${count} posts` : ""}${label ? ` for ${label}` : ""}`;
    }

    case "download": {
      const count = num(meta.count) ?? 1;
      return count > 1 ? `Downloaded ${count} files${quoted}` : `Downloaded${quoted || " a file"}`;
    }

    case "generate": {
      const cost = num(meta.cost_usd);
      const failed = meta.ok === false;
      const task = label || text(meta.task) || "content";
      return `Generated ${task}${cost !== null ? ` — $${cost.toFixed(4)}` : ""}${failed ? " (failed)" : ""}`;
    }

    default:
      return label || row.action;
  }
}
