import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { storeGet, storeSet, cachedVersion, __resetStoreVersions } from "./storeClient";

// These pin down the behaviour that stops one editor silently destroying another's
// work. Before optimistic locking, PUT /api/store was a blind upsert: two admins
// editing the same calendar blob meant the second save overwrote the first with no
// error and no way to recover it.

let calls: Array<{ method: string; version: string | null; body: any }> = [];

function mockServer(handlers: Array<() => { status: number; body: any }>) {
  let i = 0;
  global.fetch = vi.fn(async (url: any, init: any = {}) => {
    const method = init.method || "GET";
    const headers = init.headers || {};
    calls.push({ method, version: headers["X-Store-Version"] ?? null, body: init.body ? JSON.parse(init.body) : null });
    const h = handlers[Math.min(i, handlers.length - 1)];
    i += 1;
    const { status, body } = h();
    return { ok: status >= 200 && status < 300, status, json: async () => body } as any;
  }) as any;
}

const okRead = (value: any, version: number) => () => ({ status: 200, body: { value, version } });
const okWrite = (version: number) => () => ({ status: 200, body: { ok: true, version } });
const conflict = (value: any, version: number, who = "someone@else.com") => () => ({
  status: 409,
  body: { error: "changed", code: "version_conflict", value, version, updated_by: who }
});

beforeEach(() => {
  calls = [];
  __resetStoreVersions();
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; }
  });
  vi.stubGlobal("window", { localStorage: globalThis.localStorage });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("storeGet", () => {
  it("returns the server value and records its version", async () => {
    mockServer([okRead({ items: [1] }, 7)]);
    const r = await storeGet<any>("kognoz-calendar");
    expect(r.value).toEqual({ items: [1] });
    expect(r.version).toBe(7);
    expect(r.stale).toBe(false);
    expect(cachedVersion("kognoz-calendar")).toBe(7);
  });

  it("falls back to the local cache when the server is unreachable, and says it is stale", async () => {
    localStorage.setItem("kognoz-design", JSON.stringify({ set: "glass" }));
    global.fetch = vi.fn(async () => { throw new Error("offline"); }) as any;
    const r = await storeGet<any>("kognoz-design");
    expect(r.value).toEqual({ set: "glass" });
    expect(r.stale).toBe(true);
  });
});

describe("storeSet — the conditional write", () => {
  it("sends the version it read, so the server can reject a stale write", async () => {
    mockServer([okRead({ a: 1 }, 4), okWrite(5)]);
    await storeGet("kognoz-calendar");
    const w = await storeSet("kognoz-calendar", { a: 2 });
    expect(w).toEqual({ ok: true, version: 5 });
    expect(calls[1].version).toBe("4");
  });

  it("advances the cached version after a successful write", async () => {
    mockServer([okRead({}, 1), okWrite(2)]);
    await storeGet("k");
    await storeSet("k", {});
    expect(cachedVersion("k")).toBe(2);
  });

  it("reports a conflict instead of overwriting, and hands back the server's copy", async () => {
    // The whole point: the caller learns it lost, and can show the winning value.
    mockServer([okRead({ items: ["mine"] }, 3), conflict({ items: ["theirs"] }, 9, "harpreet@kognoz.com")]);
    await storeGet("kognoz-calendar");
    const w = await storeSet<any>("kognoz-calendar", { items: ["mine", "edited"] });
    expect(w.ok).toBe(false);
    if (w.ok || w.reason !== "conflict") throw new Error("expected a conflict");
    expect(w.serverValue).toEqual({ items: ["theirs"] });
    expect(w.updatedBy).toBe("harpreet@kognoz.com");
  });

  it("adopts the server version after a conflict so the next write can succeed", async () => {
    mockServer([okRead({}, 3), conflict({ items: [] }, 9), okWrite(10)]);
    await storeGet("k");
    await storeSet("k", { x: 1 });
    expect(cachedVersion("k")).toBe(9);
    await storeSet("k", { x: 2 });
    expect(calls[2].version).toBe("9");
  });

  it("omits the header when no version has been read, preserving the old unconditional write", async () => {
    // Keeps a browser tab on the previous build working instead of breaking mid-deploy.
    mockServer([okWrite(1)]);
    await storeSet("k", { x: 1 });
    expect(calls[0].version).toBeNull();
  });

  it("reports offline rather than claiming success when the request fails", async () => {
    global.fetch = vi.fn(async () => { throw new Error("offline"); }) as any;
    const w = await storeSet("k", { x: 1 });
    expect(w).toEqual({ ok: false, reason: "offline" });
  });

  it("still writes the local cache when the server rejects, so nothing is lost from view", async () => {
    mockServer([okRead({}, 1), conflict({ items: ["theirs"] }, 2)]);
    await storeGet("k");
    await storeSet("k", { items: ["mine"] });
    // The server's winning copy replaces the cache — the user is shown the truth.
    expect(JSON.parse(localStorage.getItem("k") as string)).toEqual({ items: ["theirs"] });
  });
});

describe("the scenario this exists to prevent", () => {
  it("two editors: the second save is refused, not silently applied", async () => {
    mockServer([
      okRead({ items: ["a", "b"] }, 5),      // both tabs read version 5
      okWrite(6),                             // editor A saves -> version 6
      conflict({ items: ["a", "b", "A"] }, 6) // editor B, still on 5, is refused
    ]);
    await storeGet("kognoz-calendar");
    const a = await storeSet("kognoz-calendar", { items: ["a", "b", "A"] });
    expect(a.ok).toBe(true);

    __resetStoreVersions();
    await storeGet("kognoz-calendar").catch(() => null);
    const b = await storeSet<any>("kognoz-calendar", { items: ["a", "b", "B"] });
    expect(b.ok).toBe(false);
    if (!b.ok && b.reason === "conflict") {
      expect(b.serverValue).toEqual({ items: ["a", "b", "A"] }); // A's work survives
    }
  });
});
