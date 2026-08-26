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
}

export type StoreWrite<T> =
  | { ok: true; version: number }
  | { ok: false; reason: "conflict"; serverValue: T | null; version: number; updatedBy?: string }
  | { ok: false; reason: "offline" };

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

function writeLocal(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — the server copy is the one that matters */
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
 */
export async function storeSet<T = unknown>(key: string, value: unknown): Promise<StoreWrite<T>> {
  writeLocal(key, value);
  const expected = cachedVersion(key);
  try {
    const res = await fetch(`/api/store?key=${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(expected !== null ? { "X-Store-Version": String(expected) } : {})
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
    if (!res.ok) return { ok: false, reason: "offline" };

    const next = typeof data?.version === "number" ? data.version : (expected ?? 0) + 1;
    versions.set(key, next);
    return { ok: true, version: next };
  } catch {
    return { ok: false, reason: "offline" };
  }
}
