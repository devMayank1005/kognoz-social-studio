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
