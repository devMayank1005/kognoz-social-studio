import { describe, it, expect } from "vitest";
import {
  ACTIONS,
  CLIENT_ACTIONS,
  isClientAction,
  toScreen,
  clientIp,
  describeDevice,
  clampMeta,
  describeActivity
} from "./activityEvents";

// This trail exists to answer questions about a real person's conduct, so the rules
// that decide what may enter it are security rules, not formatting ones. Most of what
// follows is about what must NOT get in.

const headers = (h: Record<string, string>) => ({
  get: (name: string) => h[name.toLowerCase()] ?? null
});

describe("the client cannot forge a session", () => {
  it("refuses login and logout from a browser", () => {
    // The whole trail rests on this. If a page could post its own login events, it
    // could record sign-ins that never happened — worse than no trail, because the
    // result still looks authoritative.
    for (const forbidden of ["login", "logout", "login_failed", "login_blocked"]) {
      expect(isClientAction(forbidden)).toBe(false);
    }
  });

  it("refuses the row the view synthesises", () => {
    // `generate` rows come from api_call_log via v_all_activity. Accepting one from a
    // browser would double-count spend against the table that bills it.
    expect(isClientAction("generate")).toBe(false);
  });

  it("refuses anything not in the vocabulary", () => {
    for (const bad of ["", "DROP TABLE", "content_created ", "Content_Created", null, 7, {}, undefined]) {
      expect(isClientAction(bad)).toBe(false);
    }
  });

  it("accepts exactly the user actions we instrument", () => {
    expect([...CLIENT_ACTIONS].sort()).toEqual(
      ["content_created", "content_deleted", "content_edited", "content_status_changed", "download", "month_generated"].sort()
    );
    for (const a of CLIENT_ACTIONS) expect(isClientAction(a)).toBe(true);
  });

  it("keeps every client action inside the full vocabulary", () => {
    for (const a of CLIENT_ACTIONS) expect(ACTIONS).toContain(a);
  });
});

describe("toScreen", () => {
  it("accepts the known screens, case-insensitively", () => {
    expect(toScreen("calendar")).toBe("calendar");
    expect(toScreen("  STUDIO ")).toBe("studio");
  });

  it("falls back rather than storing free text", () => {
    for (const bad of ["../../etc", "", null, 42]) expect(toScreen(bad)).toBe("unknown");
  });
});

describe("clientIp — the address must be the user's, not Vercel's", () => {
  it("takes the FIRST x-forwarded-for entry", () => {
    // The chain is client, then each proxy. Taking the last would log Vercel's own
    // edge address for every single user: plausible-looking and entirely useless.
    expect(clientIp(headers({ "x-forwarded-for": "14.96.50.18, 76.76.21.21, 10.0.0.1" }))).toBe("14.96.50.18");
  });

  it("tolerates the spacing real proxies emit", () => {
    expect(clientIp(headers({ "x-forwarded-for": "  14.96.50.18  ,76.76.21.21" }))).toBe("14.96.50.18");
  });

  it("falls back through the header variants in order", () => {
    expect(clientIp(headers({ "x-vercel-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(headers({ "x-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2" }))).toBe("1.1.1.1");
  });

  it("returns empty rather than guessing when nothing is present", () => {
    expect(clientIp(headers({}))).toBe("");
    expect(clientIp(headers({ "x-forwarded-for": "" }))).toBe("");
    expect(clientIp(headers({ "x-forwarded-for": " , , " }))).toBe("");
  });

  it("normalises loopback, so local development is not mistaken for a real address", () => {
    for (const local of ["::1", "127.0.0.1", "::ffff:127.0.0.1"]) {
      expect(clientIp(headers({ "x-forwarded-for": local }))).toBe("local");
    }
  });

  it("collapses the IPv4-mapped form onto the plain one", () => {
    // Otherwise the same person appears as two addresses in the timeline.
    expect(clientIp(headers({ "x-forwarded-for": "::ffff:14.96.50.18" }))).toBe("14.96.50.18");
  });

  it("strips an IPv4 port but never mangles an IPv6 address", () => {
    expect(clientIp(headers({ "x-forwarded-for": "14.96.50.18:52134" }))).toBe("14.96.50.18");
    expect(clientIp(headers({ "x-forwarded-for": "2001:db8::8a2e:370:7334" }))).toBe("2001:db8::8a2e:370:7334");
  });

  it("strips brackets and IPv6 zone ids", () => {
    expect(clientIp(headers({ "x-forwarded-for": "[2001:db8::1]" }))).toBe("2001:db8::1");
    expect(clientIp(headers({ "x-forwarded-for": "fe80::1%eth0" }))).toBe("fe80::1");
  });
});

describe("describeDevice", () => {
  it("reads a real Chrome-on-Mac string", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0 Safari/537.36"
      )
    ).toBe("Chrome on Mac");
  });

  it("does not call Edge or Opera 'Chrome', nor Chrome 'Safari'", () => {
    // Every one of these strings contains the more generic token too, so order of
    // testing is the whole correctness question here.
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36 Edg/120")).toBe("Edge on Windows");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36 OPR/106")).toBe("Opera on Windows");
    expect(describeDevice("Mozilla/5.0 (Macintosh) Chrome/120 Safari/537.36")).toBe("Chrome on Mac");
    expect(describeDevice("Mozilla/5.0 (Macintosh) Version/17 Safari/605.1.15")).toBe("Safari on Mac");
  });

  it("recognises phones", () => {
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17 Safari/604.1")).toBe("Safari on iOS");
    expect(describeDevice("Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36")).toBe("Chrome on Android");
  });

  it("says so rather than inventing a device", () => {
    for (const empty of ["", "   ", null, undefined]) expect(describeDevice(empty)).toBe("Unknown device");
    expect(describeDevice("curl/8.4.0")).toBe("Unknown device");
  });
});

describe("clampMeta — meta is client input, so it is bounded in every direction", () => {
  it("keeps ordinary values", () => {
    expect(clampMeta({ format: "Carousel", count: 5, ok: true, missing: null })).toEqual({
      format: "Carousel",
      count: 5,
      ok: true,
      missing: null
    });
  });

  it("caps the number of keys", () => {
    const big = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(clampMeta(big) || {})).toHaveLength(12);
  });

  it("truncates long strings instead of storing a megabyte", () => {
    const out = clampMeta({ name: "x".repeat(10_000) })!;
    expect((out.name as string).length).toBe(200);
  });

  it("caps array length", () => {
    expect((clampMeta({ ids: Array.from({ length: 500 }, (_, i) => i) })!.ids as unknown[])).toHaveLength(20);
  });

  it("refuses runaway nesting", () => {
    // A deeply nested object is a cheap way to make the column expensive to read.
    let deep: Record<string, unknown> = { bottom: true };
    for (let i = 0; i < 50; i++) deep = { nest: deep };
    const out = clampMeta(deep);
    expect(JSON.stringify(out).length).toBeLessThan(200);
  });

  it("drops what jsonb cannot hold", () => {
    const out = clampMeta({ fn: () => 1, sym: Symbol("s"), nope: undefined, nan: NaN, inf: Infinity, keep: 1 });
    expect(out).toEqual({ keep: 1 });
  });

  it("returns null for nothing worth storing, so the column stays honestly empty", () => {
    for (const empty of [{}, null, undefined, [], "text", 42, { fn: () => 1 }]) {
      expect(clampMeta(empty)).toBeNull();
    }
  });

  it("survives a self-referencing object rather than hanging", () => {
    const loop: Record<string, unknown> = { name: "a" };
    loop.self = loop;
    expect(() => JSON.stringify(clampMeta(loop))).not.toThrow();
  });
});

describe("describeActivity", () => {
  it("names the sign-in method, because that is the difference that matters", () => {
    expect(describeActivity({ action: "login", meta: { provider: "azure-ad" } })).toBe("Signed in with Microsoft");
    expect(describeActivity({ action: "login", meta: { provider: "credentials" } })).toBe("Signed in with password");
    expect(describeActivity({ action: "logout" })).toBe("Signed out");
  });

  it("shows who a failed or blocked sign-in claimed to be", () => {
    expect(describeActivity({ action: "login_failed", entity_label: "manish01@gmail.com" })).toBe(
      "Failed sign-in as manish01@gmail.com"
    );
    expect(describeActivity({ action: "login_blocked", entity_label: "outsider@example.com" })).toContain("blocked");
  });

  it("describes calendar work with the item's own title", () => {
    expect(describeActivity({ action: "content_created", entity_label: "AI in hiring" })).toBe("Created “AI in hiring”");
    expect(describeActivity({ action: "content_deleted", entity_label: "AI in hiring" })).toBe("Deleted “AI in hiring”");
    expect(describeActivity({ action: "content_status_changed", entity_label: "AI in hiring", meta: { to: "Posted" } })).toBe(
      "Marked “AI in hiring” Posted"
    );
  });

  it("counts a coalesced download rather than reporting one file", () => {
    expect(describeActivity({ action: "download", entity_label: "kognoz-carousel", meta: { count: 5 } })).toBe(
      "Downloaded 5 files “kognoz-carousel”"
    );
    expect(describeActivity({ action: "download", entity_label: "kognoz-deck.pdf", meta: { count: 1 } })).toBe(
      "Downloaded “kognoz-deck.pdf”"
    );
  });

  it("puts the cost on a generation, which is the column that gets audited", () => {
    expect(describeActivity({ action: "generate", entity_label: "carousel", meta: { cost_usd: 0.0081 } })).toBe(
      "Generated carousel — $0.0081"
    );
    expect(describeActivity({ action: "generate", entity_label: "verify", meta: { cost_usd: 0.02, ok: false } })).toContain(
      "(failed)"
    );
  });

  it("never returns an empty string, however thin the row", () => {
    for (const row of [
      { action: "content_created" },
      { action: "download" },
      { action: "generate" },
      { action: "month_generated" },
      { action: "something_new_we_added_later" }
    ]) {
      expect(describeActivity(row).length).toBeGreaterThan(0);
    }
  });

  it("ignores a meta value of the wrong type instead of printing NaN or undefined", () => {
    const out = describeActivity({ action: "generate", entity_label: "carousel", meta: { cost_usd: "free" } });
    expect(out).toBe("Generated carousel");
    expect(describeActivity({ action: "download", meta: { count: "many" } })).toBe("Downloaded a file");
  });
});
