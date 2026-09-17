import { describe, it, expect } from "vitest";
import { ALLOWED_SSO_DOMAINS, isAllowedSsoEmail } from "./ssoDomains";

// This gate decides who gets into the app through the Microsoft button. The cases that
// matter most are the look-alike addresses a substring check would have let through.

describe("isAllowedSsoEmail", () => {
  it("admits every listed company domain", () => {
    expect(ALLOWED_SSO_DOMAINS).toContain("konverz.ai");
    for (const domain of ALLOWED_SSO_DOMAINS) {
      expect(isAllowedSsoEmail(`someone@${domain}`)).toBe(true);
    }
  });

  it("ignores case and surrounding whitespace", () => {
    expect(isAllowedSsoEmail("  Someone@Konverz.AI ")).toBe(true);
    expect(isAllowedSsoEmail("SOMEONE@KOGNOZCONSULTING.COM")).toBe(true);
  });

  it("rejects look-alike domains that merely contain an allowed one", () => {
    for (const who of [
      "a@konverz.ai.attacker.test",
      "a@kognoz.com.evil.tld",
      "konverz.ai@evil.tld",
      "kognoz.com@evil.tld",
      "a@notkonverz.ai",
      "a@konverz.co",
      "a@kognozconsulting.co"
    ]) {
      expect(isAllowedSsoEmail(who)).toBe(false);
    }
  });

  it("rejects outside and missing addresses", () => {
    for (const who of ["a@gmail.com", "", "   ", null, undefined]) {
      expect(isAllowedSsoEmail(who)).toBe(false);
    }
  });
});
