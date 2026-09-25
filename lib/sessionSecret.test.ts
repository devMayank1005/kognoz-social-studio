import { describe, it, expect, vi, afterEach } from "vitest";
import { DEV_SECRET, resolveSessionSecret } from "./sessionSecret";

// THE HOLE THIS CLOSES. middleware.ts and lib/auth.ts both read
//   process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "<a literal in the repo>"
// so a missing environment variable did not fail — it signed and verified with a string
// anybody holding the repository could read. A forged token would have passed the
// middleware, getServerSession in all four routes, and isAdmin(), which answers with
// colleagues' addresses and movements.
//
// lib/adminAccess.ts states the rule this restores: an unset allowlist denies everyone,
// because "failing closed makes that a support ticket instead of a breach".

afterEach(() => vi.restoreAllMocks());

describe("resolveSessionSecret", () => {
  it("uses NEXTAUTH_SECRET when it is set", () => {
    expect(resolveSessionSecret({ NEXTAUTH_SECRET: "real" }, "production")).toBe("real");
  });

  it("accepts AUTH_SECRET as the alternative spelling", () => {
    expect(resolveSessionSecret({ AUTH_SECRET: "real" }, "production")).toBe("real");
  });

  it("prefers NEXTAUTH_SECRET when both are set", () => {
    expect(resolveSessionSecret({ NEXTAUTH_SECRET: "a", AUTH_SECRET: "b" }, "production")).toBe("a");
  });

  it("REFUSES TO RUN in production when neither is set", () => {
    // The whole point. Previously this returned a secret from the repo.
    expect(() => resolveSessionSecret({}, "production")).toThrow(/NEXTAUTH_SECRET is not set/);
  });

  it("treats whitespace as unset, because an empty Vercel variable is a missing one", () => {
    expect(() => resolveSessionSecret({ NEXTAUTH_SECRET: "   " }, "production")).toThrow();
  });

  it("says when the variable exists but is blank, so nobody hunts for a missing one", () => {
    expect(() => resolveSessionSecret({ NEXTAUTH_SECRET: "" }, "production")).toThrow(/exists but its value is empty/);
    expect(() => resolveSessionSecret({}, "production")).not.toThrow(/exists but/);
  });

  it("lets development run, but says so", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveSessionSecret({}, "development")).toBe(DEV_SECRET);
    expect(warn).toHaveBeenCalled();
  });

  it("never returns a usable-looking secret it invented", () => {
    // If the development fallback ever stops looking like a placeholder, somebody will
    // eventually ship it.
    expect(DEV_SECRET).toMatch(/insecure|development/i);
  });
});

describe("resolving lazily did not weaken the refusal", () => {
  // These two belong together, and the pair is the whole point of the change.
  //
  // The first version resolved the secret at module load, which broke `next build`: Next
  // imports every route module while collecting page data, and executes route handlers while
  // generating static pages, so the check fired during compilation — where nothing is being
  // signed and no secret is needed. The deploy died on /api/auth.
  //
  // Making it lazy fixes that. The risk in making it lazy is quietly making it optional, so:
  // importing must be safe, and CALLING must still refuse.

  it("imports without touching the environment", async () => {
    // A fresh import with the variables cleared must not throw — this is the build path.
    const saved = { n: process.env.NEXTAUTH_SECRET, a: process.env.AUTH_SECRET };
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;
    try {
      vi.resetModules();
      // A fresh evaluation of the module, not the cached one from this file's own import.
      const mod = await import("./sessionSecret");
      expect(typeof mod.sessionSecret).toBe("function");
    } finally {
      if (saved.n !== undefined) process.env.NEXTAUTH_SECRET = saved.n;
      if (saved.a !== undefined) process.env.AUTH_SECRET = saved.a;
    }
  });

  it("still refuses in production when the secret is actually needed", () => {
    // The guarantee the lazy version must keep: never sign with a secret from the repo.
    expect(() => resolveSessionSecret({}, "production")).toThrow(/NEXTAUTH_SECRET is not set/);
  });

  it("exports no eagerly-resolved constant for a caller to reintroduce", async () => {
    // A `SESSION_SECRET` const is exactly what broke the build; importing one anywhere would
    // put the module-load evaluation straight back.
    const mod = await import("./sessionSecret");
    expect(Object.keys(mod)).not.toContain("SESSION_SECRET");
  });
});
