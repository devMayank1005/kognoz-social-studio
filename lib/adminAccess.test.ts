import { describe, it, expect } from "vitest";
import { parseAdminEmails, isAdminEmail } from "./adminAccess";

// This gate stands in front of every person's IP address and movements. The tests that
// matter most are the ones about what happens when it is misconfigured.

describe("an unconfigured allowlist admits nobody", () => {
  it("denies when ADMIN_EMAILS is unset, empty or junk", () => {
    // Failing OPEN here would mean a deploy that forgot one env var quietly published
    // everyone's whereabouts to anyone who could sign in.
    for (const raw of [undefined, null, "", "   ", ",,,", "not-an-email"]) {
      expect(isAdminEmail("mayank@kognozconsulting.com", raw)).toBe(false);
    }
  });

  it("denies an empty or missing candidate even against a real allowlist", () => {
    for (const who of [undefined, null, "", "  "]) {
      expect(isAdminEmail(who, "mayank@kognozconsulting.com")).toBe(false);
    }
  });
});

describe("parseAdminEmails", () => {
  it("splits on commas, semicolons and whitespace", () => {
    expect(parseAdminEmails("a@x.com, b@x.com;c@x.com d@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com"
    ]);
  });

  it("lowercases and trims, because env vars get pasted by hand", () => {
    expect(parseAdminEmails("  Mayank@Kognozconsulting.COM  ")).toEqual(["mayank@kognozconsulting.com"]);
  });

  it("drops entries that are not addresses", () => {
    expect(parseAdminEmails("admin, a@x.com, true")).toEqual(["a@x.com"]);
  });
});

describe("isAdminEmail", () => {
  const list = "mayank@kognozconsulting.com, lokesh@kognozconsulting.com";

  it("admits a listed address regardless of casing", () => {
    expect(isAdminEmail("mayank@kognozconsulting.com", list)).toBe(true);
    expect(isAdminEmail("  MAYANK@kognozconsulting.com ", list)).toBe(true);
  });

  it("refuses an address that is not listed", () => {
    expect(isAdminEmail("manish01@gmail.com", list)).toBe(false);
  });

  it("matches the whole address, never a substring", () => {
    // "not-mayank@..." contains a listed address as a substring; an `includes` check on
    // the joined string would have let it through.
    expect(isAdminEmail("not-mayank@kognozconsulting.com", list)).toBe(false);
    expect(isAdminEmail("mayank@kognozconsulting.com.attacker.test", list)).toBe(false);
    expect(isAdminEmail("mayank@kognozconsulting.co", list)).toBe(false);
  });

  it("does not treat a domain as a wildcard", () => {
    expect(isAdminEmail("anyone@kognozconsulting.com", list)).toBe(false);
  });
});
