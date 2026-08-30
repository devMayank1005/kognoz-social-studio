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

// ---------------------------------------------------------------------------
// A write must never go out without a version the server actually gave us.
//
// The server treats a PUT with no X-Store-Version as an unconditional upsert. Because
// a failed read used to return without recording a version, one dropped GET switched
// optimistic locking off for the whole session — every later save blindly overwrote
// whatever was on the server, which is exactly what locking exists to prevent.
// ---------------------------------------------------------------------------
describe("a failed read must not license a blind write", () => {
  it("sends no PUT at all when the version cannot be established", async () => {
    mockServer([() => ({ status: 503, body: { error: "store unreachable" } })]);
    const res = await storeSet("kognoz-calendar", { items: ["mine"] });

    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("offline");
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("keeps the value locally so the user's work is not thrown away", async () => {
    mockServer([() => ({ status: 503, body: {} })]);
    await storeSet("kognoz-calendar", { items: ["mine"] });
    expect(JSON.parse(localStorage.getItem("kognoz-calendar") as string)).toEqual({ items: ["mine"] });
  });

  it("reads a version first when it has none, then writes conditionally", async () => {
    mockServer([okRead({ items: [] }, 7), okWrite(8)]);
    const res = await storeSet("kognoz-calendar", { items: ["new"] });

    expect(res.ok).toBe(true);
    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0].version).toBe("7"); // the version the probe read, not a guess
    expect(cachedVersion("kognoz-calendar")).toBe(8);
  });

  it("the probe does not clobber the pending value in the local cache", async () => {
    mockServer([okRead({ items: ["server"] }, 3), okWrite(4)]);
    await storeSet("kognoz-calendar", { items: ["pending"] });
    expect(JSON.parse(localStorage.getItem("kognoz-calendar") as string)).toEqual({ items: ["pending"] });
  });

  it("every write carries a version once one is known", async () => {
    mockServer([okRead({ a: 1 }, 2), okWrite(3), okWrite(4)]);
    await storeGet("kognoz-design");
    await storeSet("kognoz-design", { a: 2 });
    await storeSet("kognoz-design", { a: 3 });

    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts.map((p) => p.version)).toEqual(["2", "3"]);
    expect(puts.every((p) => p.version !== null)).toBe(true);
  });

  it("a stale read leaves no version behind for a later write to reuse", async () => {
    mockServer([() => ({ status: 503, body: {} })]);
    const read = await storeGet("kognoz-calendar");
    expect(read.stale).toBe(true);
    expect(cachedVersion("kognoz-calendar")).toBeNull();
  });
});
