// Versioned client for /api/store.
//
// The old helpers were duplicated between Studio and CalendarView, wrote blind,
// and read localStorage in preference to the server. That combination lost work:
// a tab holding a stale cache could overwrite a newer server blob with no error.
//
// Here the server is authoritative for anything we are about to write back, every
// write carries the version it was based on, and a conflict comes back as data to
// reconcile rather than an exception to swallow.
"use client";

export interface StoreRead<T> {
  value: T | null;
  version: number;
  /** true when the server could not be reached and this came from the local cache. */
  stale: boolean;
  /**
   * The server understood us and said no — a 4xx, which for this route means the
   * key is not in STORE_KEYS.
   *
   * Worth separating from `stale` because the two need opposite responses. An
   * unreachable server is a network problem: wait, retry, your data is fine. A
   * rejected key is a BUG IN THIS APP that no amount of retrying fixes, and
   * reporting it as "the server did not answer" sends people to check their wifi.
   * That is exactly what happened when the Konverz keys shipped without being
   * added to the allowlist.
   */
  rejected?: boolean;
  /**
   * The server knows us and says we are not signed in — a 401.
   *
   * Third state, because it needs a third answer. `stale` means wait and retry; `rejected`
   * means this app has a bug; this means sign in again. Conflating it with `stale` is what
   * told people "could not reach the server" when their session had simply ended.
   */
  unauthenticated?: boolean;
}

export type StoreWrite<T> =
  | { ok: true; version: number }
  | { ok: false; reason: "conflict"; serverValue: T | null; version: number; updatedBy?: string }
  // `offline` still means the value is safe on this device. `lost` means it is not — see
  // writeLocal. `signed-out` is neither: the server is fine and is refusing us.
  | { ok: false; reason: "offline" | "lost" | "signed-out" };

/** Last version seen per key, so a write can be conditional on it. */
const versions = new Map<string, number>();

export function cachedVersion(key: string): number | null {
  return versions.has(key) ? (versions.get(key) as number) : null;
}

/** Test seam — reset module state between cases. */
export function __resetStoreVersions() {
  versions.clear();
}

function readLocal<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Keep a copy on this device. Returns whether that actually worked.
 *
 * It used to swallow the failure, reasoning that "the server copy is the one that matters" —
 * true everywhere except the one path where this is called BECAUSE there is no server copy.
 * A deck carrying base64 photos can pass the ~5MB origin quota, and the write would then
 * throw, be discarded, and the person be told their deck was kept safe.
 */
function writeLocal(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota, or a private window that refuses storage entirely.
    return false;
  }
}

/**
 * Read from the server, recording the version so a later write can be conditional.
 * localStorage is a fallback for when the server is unreachable, never a shortcut
 * past it — serving a cached blob as if it were current is what let stale tabs
 * clobber newer work.
 */
export async function storeGet<T>(key: string): Promise<StoreRead<T>> {
  try {
    const res = await fetch(`/api/store?key=${encodeURIComponent(key)}`);
    if (res.status === 401) {
      // The session ended. Not a transport problem, and not this app's bug.
      return { value: readLocal<T>(key), version: cachedVersion(key) ?? 0, stale: true, unauthenticated: true };
    }
    if (res.status >= 400 && res.status < 500) {
      // Not a transport failure. Surface it as itself so the UI can say so, and
      // log it once — a 400 here means a key reached production that the route
      // was never taught about.
      console.error(`[store] ${key} rejected with HTTP ${res.status}. Is it in STORE_KEYS and in the store_key_check constraint?`);
      return { value: readLocal<T>(key), version: cachedVersion(key) ?? 0, stale: true, rejected: true };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const version = typeof data?.version === "number" ? data.version : 0;
    versions.set(key, version);
    if (data?.value != null) writeLocal(key, data.value);
    return { value: (data?.value as T) ?? null, version, stale: false };
  } catch {
    return { value: readLocal<T>(key), version: cachedVersion(key) ?? 0, stale: true };
  }
}

/** Cached copy for first paint. Never use this as the basis for a write. */
export function storePeek<T>(key: string): T | null {
  return readLocal<T>(key);
}

/**
 * Conditional write. Sends the version this value was based on; the server rejects
 * the write with 409 if anyone else has saved since, and returns their version so
 * the caller can reconcile rather than overwrite.
 *
 * A write only goes out once we hold a version that actually came from the server.
 * The server treats a PUT with no `X-Store-Version` as unconditional, so sending one
 * after a failed read overwrites whatever is there — which is how a single dropped
 * GET used to switch optimistic locking off for the rest of the session, and how a
 * tab showing the seed template could replace a real calendar with it.
 *
 * When no version is held we read one first. If that read also fails we report
 * `offline` and send nothing: the local cache keeps the value, and the server keeps
 * the copy we were never able to compare against.
 */
export async function storeSet<T = unknown>(key: string, value: unknown): Promise<StoreWrite<T>> {
  if (cachedVersion(key) === null) {
    // storeGet caches the server's copy locally, so probe BEFORE recording `value`
    // or the pending write is erased by the value we were about to replace.
    const probe = await storeGet<T>(key);
    if (probe.stale) {
      const kept = writeLocal(key, value);
      return { ok: false, reason: probe.unauthenticated ? "signed-out" : kept ? "offline" : "lost" };
    }
  }
  const kept = writeLocal(key, value);
  const expected = cachedVersion(key);
  if (expected === null) return { ok: false, reason: kept ? "offline" : "lost" };
  try {
    const res = await fetch(`/api/store?key=${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Store-Version": String(expected)
      },
      body: JSON.stringify(value)
    });
    const data = await res.json().catch(() => null);

    if (res.status === 409) {
      const serverVersion = typeof data?.version === "number" ? data.version : 0;
      versions.set(key, serverVersion);
      if (data?.value != null) writeLocal(key, data.value);
      return {
        ok: false,
        reason: "conflict",
        serverValue: (data?.value as T) ?? null,
        version: serverVersion,
        updatedBy: data?.updated_by
      };
    }
    // A 401 here means the session ended between the probe and the write.
    if (res.status === 401) return { ok: false, reason: "signed-out" };
    if (!res.ok) return { ok: false, reason: kept ? "offline" : "lost" };

    const next = typeof data?.version === "number" ? data.version : expected + 1;
    versions.set(key, next);
    return { ok: true, version: next };
  } catch {
    return { ok: false, reason: kept ? "offline" : "lost" };
  }
}
