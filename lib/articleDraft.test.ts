import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ARTICLE_DRAFT_KEY,
  isWorthSaving,
  makeDraft,
  serialiseDraft,
  parseDraft,
  sameTopic
} from "./articleDraft";

// The article was the one expensive thing in the app that a page refresh destroyed. These
// cases are about not losing it, and about never taking the editor down while trying to
// bring it back — parseDraft runs on mount, so a corrupt value must fail quietly.

const draft = makeDraft("AI and org design", "Human + AI", "# Heading\n\nBody copy.", "2026-08-31T10:00:00.000Z");

describe("round-tripping a draft", () => {
  it("survives serialise and parse unchanged", () => {
    expect(parseDraft(serialiseDraft(draft))).toEqual(draft);
  });

  it("keeps markdown intact, including newlines and headings", () => {
    const md = makeDraft("t", "p", "# One\n\n## Two\n\n- bullet\n- bullet\n\n**bold** and *em*", "s");
    expect(parseDraft(serialiseDraft(md))?.text).toBe(md.text);
  });

  it("uses a single stable key", () => {
    expect(ARTICLE_DRAFT_KEY).toBe("kognoz-article-draft");
  });

  it("tolerates missing topic and pillar rather than dropping the article", () => {
    const partial = parseDraft(JSON.stringify({ text: "the words" }));
    expect(partial).toEqual({ topic: "", pillar: "", text: "the words", savedAt: "" });
  });
});

describe("nothing unusable reaches the editor", () => {
  it("returns null for absent storage", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft(undefined)).toBeNull();
    expect(parseDraft("")).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing on mount", () => {
    expect(() => parseDraft("{not json")).not.toThrow();
    expect(parseDraft("{not json")).toBeNull();
  });

  it("returns null for valid JSON of the wrong shape", () => {
    expect(parseDraft('"a string"')).toBeNull();
    expect(parseDraft("42")).toBeNull();
    expect(parseDraft("null")).toBeNull();
    expect(parseDraft("[1,2,3]")).toBeNull();
    expect(parseDraft(JSON.stringify({ topic: "t" }))).toBeNull(); // no text at all
    expect(parseDraft(JSON.stringify({ text: 123 }))).toBeNull(); // text of the wrong type
  });

  it("does not restore an empty article", () => {
    expect(parseDraft(JSON.stringify({ text: "" }))).toBeNull();
    expect(parseDraft(JSON.stringify({ text: "   \n\t " }))).toBeNull();
  });
});

describe("isWorthSaving", () => {
  it("skips empty and whitespace-only text", () => {
    expect(isWorthSaving("")).toBe(false);
    expect(isWorthSaving("   ")).toBe(false);
    expect(isWorthSaving(undefined as unknown as string)).toBe(false);
  });

  it("saves anything with real content", () => {
    expect(isWorthSaving("a")).toBe(true);
  });
});

describe("sameTopic", () => {
  it("ignores case and spacing, which are not the user's intent", () => {
    expect(sameTopic("AI and org design", "ai and org design")).toBe(true);
    expect(sameTopic("  AI   and org  design ", "AI and org design")).toBe(true);
  });

  it("treats a genuinely different topic as different", () => {
    expect(sameTopic("AI and org design", "internal mobility")).toBe(false);
  });

  it("handles empty and missing input", () => {
    expect(sameTopic("", "")).toBe(true);
    expect(sameTopic(undefined as unknown as string, "")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// How the restored draft is wired into Studio.
//
// The first implementation decided staleness inside the restore effect, comparing the
// draft's topic against `topic`. That effect runs on mount — before the calendar-priming
// effect has put `?topic=` into state — so it always compared against an empty string and
// the mismatch notice could never fire. It failed silently, which is exactly the kind of
// thing a source guard is for.
// ---------------------------------------------------------------------------
describe("the mismatch is derived at render, not decided on mount", () => {
  const studioSrc = readFileSync(join(__dirname, "..", "components", "Studio.tsx"), "utf8");

  it("computes the mismatch in render, where the topic has settled", () => {
    expect(studioSrc).toContain("const draftTopicMismatch = Boolean(");
    expect(studioSrc).toContain("!sameTopic(draftTopic, topic)");
  });

  it("the restore effect only records which topic the draft belongs to", () => {
    const effect = studioSrc.slice(studioSrc.indexOf("localStorage.getItem(ARTICLE_DRAFT_KEY)"));
    const body = effect.slice(0, 700);
    expect(body).toContain("setDraftTopic(draft.topic)");
    // Deciding it here is the bug: it cannot see a topic that arrives later.
    expect(body).not.toContain("setStaleArticle(true)");
  });

  it("the notice listens to both the generate flag and the derived mismatch", () => {
    expect(studioSrc).toContain("{(staleArticle || draftTopicMismatch) && (");
  });

  it("a fresh write claims the current topic, so it is not immediately stale", () => {
    expect(studioSrc).toContain("setDraftTopic(topic);");
  });

  it("saving is on blur, not on every keystroke", () => {
    expect(studioSrc).toContain("onBlur={(e) => saveArticleDraft(e.target.value)}");
  });

  it("the disabled write button and the revise glyph both explain themselves", () => {
    expect(studioSrc).toContain('title={!topic.trim() ? "Type a topic first" : undefined}');
    expect(studioSrc).toContain('aria-label="Revise the article with this instruction"');
  });
});
