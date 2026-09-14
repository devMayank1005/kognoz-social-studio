import { describe, it, expect } from "vitest";
import { BRANDS, BRAND_IDS, KOGNOZ, KONVERZ, brandFor, brandKey, isBrandId } from "./brands";
import { BANNED_PHRASES } from "./slopLint";
import { STUDIO_FORMATS } from "./formats";

describe("the brand registry", () => {
  it("has both brands, and brandFor never throws", () => {
    expect(BRAND_IDS).toEqual(["kognoz", "konverz"]);
    expect(brandFor("konverz")).toBe(KONVERZ);
    expect(brandFor("nonsense")).toBe(KOGNOZ);
    expect(brandFor(undefined)).toBe(KOGNOZ);
    expect(isBrandId("konverz")).toBe(true);
    expect(isBrandId("kognoze")).toBe(false);
  });

  it("every brand fills every field the renderers and prompts read", () => {
    for (const b of Object.values(BRANDS)) {
      for (const key of [
        "name",
        "label",
        "url",
        "GRAD",
        "GRAD_DARK",
        "font",
        "displayFont",
        "googleFontsUrl",
        "core",
        "voiceHeader",
        "writingBrief",
        "vocabulary",
        "laneFallback",
        "canonNumbers",
        "readCloser",
        "speaker",
        "editVoice",
        "articleVoice",
        "exampleSource",
        "checkerFor",
        "endCta"
      ] as const) {
        expect(String(b[key]).trim().length, `${b.id}.${key}`).toBeGreaterThan(0);
      }
      expect(Object.keys(b.pillars).length, `${b.id} pillars`).toBeGreaterThan(0);
      expect(b.channelIds.length, `${b.id} channels`).toBeGreaterThan(0);
      expect(b.template.length, `${b.id} template`).toBe(36);
      expect(b.doNotAssert.length, `${b.id} doNotAssert`).toBeGreaterThan(0);
      expect(b.logos.aspect, `${b.id} logo aspect`).toBeGreaterThan(1);
      expect(b.logos.color.startsWith("data:image/"), `${b.id} logo is a data URL`).toBe(true);
    }
  });

  // The whole point of allowedPhrases is that it SUBTRACTS from the shared list.
  // A word here that the shared list does not ban is a typo doing nothing, and
  // would read as though the brand had been granted something.
  it("allowedPhrases only ever names phrases the shared list actually bans", () => {
    const banned = new Set(BANNED_PHRASES.map((p) => p.toLowerCase()));
    for (const b of Object.values(BRANDS)) {
      for (const a of b.allowedPhrases) {
        expect(banned.has(a.toLowerCase()), `${b.id} exempts "${a}", which is not on the banned list`).toBe(true);
      }
    }
  });

  it("Konverz exempts the two words its own canon is built on", () => {
    expect(KONVERZ.allowedPhrases).toEqual(["journey", "elevate"]);
    expect(KOGNOZ.allowedPhrases).toEqual([]);
  });

  // lib/brandCore.ts removed both of these deliberately, with a written reason,
  // because DO_NOT_ASSERT forbids them. The v4 reference file still carries them,
  // so porting its Kognoz strings over the corrected ones is a live hazard.
  it("the Kognoz canon does not carry the two claims research could not confirm", () => {
    const kognozText = [KOGNOZ.core, KOGNOZ.voiceHeader, KOGNOZ.writingBrief, KOGNOZ.vocabulary].join("\n");
    expect(kognozText).not.toMatch(/middle east/i);
    expect(kognozText).not.toMatch(/immersion index/i);
  });

  // The misspelling appears exactly once in the codebase and only as the
  // prohibition itself, in DO_NOT_ASSERT_KONVERZ. Anywhere the model is shown as
  // COPY rather than as a rule, it must not appear — a canon that misspells the
  // product teaches the model to misspell it.
  it("never spells the product \"Konverze\" in generative text", () => {
    for (const b of Object.values(BRANDS)) {
      const copy = [b.core, b.voiceHeader, b.writingBrief, b.vocabulary, b.endCta, b.readCloser].join("\n");
      expect(copy.match(/konverze(?![a-z])/i), `${b.id}`).toBeNull();
    }
    // And the prohibition is present, so nothing can quietly drop it.
    expect(KONVERZ.doNotAssert.join("\n")).toMatch(/Never write "Konverze"/);
  });

  // A guide keyed to a format that does not exist is silently dead: the lookup in
  // buildGeneratePrompt misses and nothing says so.
  it("every formatGuide key is a real format", () => {
    for (const b of Object.values(BRANDS)) {
      for (const f of Object.keys(b.formatGuide ?? {})) {
        expect(STUDIO_FORMATS as string[], `${b.id} guides unknown format "${f}"`).toContain(f);
      }
    }
  });

  it("a brand's default set and look sets exist in its own set table", () => {
    for (const b of Object.values(BRANDS)) {
      expect(b.designSets[b.defaultSet], `${b.id} defaultSet`).toBeTruthy();
      for (const s of b.lookSets) expect(b.designSets[s], `${b.id} lookSet ${s}`).toBeTruthy();
    }
  });

  it("the default channel is a company page, never a named person", () => {
    expect(KOGNOZ.defaultChannel).toBe("Kognoz page");
    expect(KONVERZ.defaultChannel).toBe("Konverz page");
    for (const b of Object.values(BRANDS)) expect(b.channelIds).toContain(b.defaultChannel);
  });

  // The existing Kognoz keys are spelled "kognoz-<name>". Scoping by brand id has
  // to reproduce them byte for byte or the deploy silently orphans the team's
  // calendar, house style and voice corpus.
  it("brandKey reproduces the existing Kognoz keys exactly", () => {
    for (const name of ["calendar", "design", "house-prefs", "style-memory", "voice-samples", "source-material"]) {
      expect(brandKey(KOGNOZ, name)).toBe(`kognoz-${name}`);
      expect(brandKey(KONVERZ, name)).toBe(`konverz-${name}`);
    }
  });
});
