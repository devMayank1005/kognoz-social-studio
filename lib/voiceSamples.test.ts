import { describe, it, expect } from "vitest";
import {
  DEFAULT_SAMPLE_COUNT,
  MIN_SAMPLE_CHARS,
  stableSeed,
  coerceSamples,
  formatSamplesBlock,
  mergeSamples,
  newSample,
  pickSamples,
  samplesFromTemplate,
  splitPastedSamples,
  isChannelId,
  type VoiceSample
} from "./voiceSamples";
import { CHANNEL_IDS } from "./founderProfiles";
import { KONVERZ_PLAN_TEMPLATE } from "./konverzTemplate";

const s = (id: string, channel: VoiceSample["channel"], kind: VoiceSample["kind"]): VoiceSample => ({
  id,
  channel,
  kind,
  text: `sample ${id}`,
  addedAt: "2026-09-04T00:00:00.000Z"
});

describe("pickSamples", () => {
  const all = [
    s("a", "Lokesh", "post"),
    s("b", "Lokesh", "post"),
    s("c", "Lokesh", "slide"),
    s("d", "Harpreet", "post"),
    s("e", "Kognoz page", "slide")
  ];

  it("prefers the same channel and the same kind", () => {
    const picked = pickSamples(all, { channel: "Lokesh", kind: "post", count: 2 });
    expect(picked.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("falls back to the same channel before the same kind", () => {
    // Only one Lokesh post exists, so the second pick must be the Lokesh slide,
    // not Harpreet's post: whose voice it is matters more than what shape it is.
    const picked = pickSamples([s("a", "Lokesh", "post"), s("c", "Lokesh", "slide"), s("d", "Harpreet", "post")], {
      channel: "Lokesh",
      kind: "post",
      count: 2
    });
    expect(picked.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("falls back to another channel rather than returning nothing", () => {
    const picked = pickSamples([s("d", "Harpreet", "post")], { channel: "Lokesh", kind: "slide", count: 2 });
    expect(picked.map((p) => p.id)).toEqual(["d"]);
  });

  it("never returns the same sample twice", () => {
    const picked = pickSamples(all, { channel: "Lokesh", kind: "post", count: 99 });
    expect(new Set(picked.map((p) => p.id)).size).toBe(picked.length);
    expect(picked.length).toBe(all.length);
  });

  it("returns a different order for a different seed", () => {
    const one = pickSamples(all, { channel: "Lokesh", kind: "post", count: 1, seed: 0 });
    const two = pickSamples(all, { channel: "Lokesh", kind: "post", count: 1, seed: 1 });
    expect(one[0].id).not.toBe(two[0].id);
  });

  it("is stable for the same seed", () => {
    const a = pickSamples(all, { channel: "Lokesh", kind: "post", count: 3, seed: 7 });
    const b = pickSamples(all, { channel: "Lokesh", kind: "post", count: 3, seed: 7 });
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it("handles an empty corpus and a zero count", () => {
    expect(pickSamples([], { channel: "Lokesh", kind: "post" })).toEqual([]);
    expect(pickSamples(all, { channel: "Lokesh", kind: "post", count: 0 })).toEqual([]);
  });

  it("copes with a channel nobody has samples for", () => {
    const picked = pickSamples(all, { channel: "Nobody", kind: "post", count: 2 });
    expect(picked.length).toBe(2);
  });
});

describe("coerceSamples", () => {
  it("drops rows that are not usable", () => {
    const out = coerceSamples([
      { id: "1", channel: "Lokesh", kind: "post", text: "real", addedAt: "x" },
      { id: "2", channel: "Nobody", kind: "post", text: "wrong channel" },
      { id: "3", channel: "Lokesh", kind: "post", text: "   " },
      null,
      "nonsense"
    ]);
    expect(out.map((o) => o.text)).toEqual(["real"]);
  });

  it("defaults an unknown kind to post rather than dropping the sample", () => {
    const out = coerceSamples([{ id: "1", channel: "Harpreet", kind: "poem", text: "keep me" }]);
    expect(out[0].kind).toBe("post");
  });

  it("returns an empty array for anything that is not a list", () => {
    expect(coerceSamples(null)).toEqual([]);
    expect(coerceSamples({})).toEqual([]);
    expect(coerceSamples(undefined)).toEqual([]);
  });

  it("round-trips what newSample produces", () => {
    const made = newSample({ channel: "Lokesh", kind: "slide", text: "  spaced  ", note: " n " });
    expect(made.text).toBe("spaced");
    expect(made.note).toBe("n");
    expect(coerceSamples([made])).toHaveLength(1);
  });
});

describe("samplesFromTemplate", () => {
  const seeded = samplesFromTemplate("me@example.com");

  it("finds real writing in the agreed editorial plan", () => {
    expect(seeded.length).toBeGreaterThan(10);
  });

  it("only keeps samples long enough to carry a voice", () => {
    for (const x of seeded) expect(x.text.length).toBeGreaterThanOrEqual(MIN_SAMPLE_CHARS);
  });

  it("files every sample under a real channel", () => {
    for (const x of seeded) expect(CHANNEL_IDS).toContain(x.channel);
  });

  it("covers all three voices", () => {
    expect(new Set(seeded.map((x) => x.channel)).size).toBe(3);
  });

  it("gives every sample a stable id, so a second import is not a duplicate", () => {
    const again = samplesFromTemplate();
    expect(again.map((x) => x.id)).toEqual(seeded.map((x) => x.id));
  });
});

describe("mergeSamples", () => {
  it("adds only what is new", () => {
    const existing = [s("a", "Lokesh", "post")];
    const merged = mergeSamples(existing, [s("a", "Lokesh", "post"), s("b", "Lokesh", "post")]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("treats identical text as a duplicate even under a new id", () => {
    const existing = [{ ...s("a", "Lokesh", "post"), text: "same words" }];
    const merged = mergeSamples(existing, [{ ...s("zzz", "Harpreet", "post"), text: "same words" }]);
    expect(merged).toHaveLength(1);
  });

  it("is a no-op when importing twice", () => {
    const once = mergeSamples([], samplesFromTemplate());
    const twice = mergeSamples(once, samplesFromTemplate());
    expect(twice.length).toBe(once.length);
  });
});

describe("formatSamplesBlock", () => {
  it("is empty when there is nothing to show", () => {
    expect(formatSamplesBlock([])).toBe("");
  });

  it("includes the sample text and says it was written by a human", () => {
    const block = formatSamplesBlock([{ ...s("a", "Lokesh", "post"), text: "The logs said otherwise." }]);
    expect(block).toContain("The logs said otherwise.");
    expect(block).toContain("written by a human");
  });

  it("tells the model not to reuse the phrasing", () => {
    const block = formatSamplesBlock([s("a", "Lokesh", "post")]);
    expect(block.toLowerCase()).toContain("not what they wrote about");
  });
});

describe("stableSeed", () => {
  it("is deterministic, so one post keeps seeing the same writing", () => {
    expect(stableSeed("item-42")).toBe(stableSeed("item-42"));
  });

  it("differs between posts, so a month does not converge on four samples", () => {
    expect(stableSeed("item-1")).not.toBe(stableSeed("item-2"));
  });

  it("is never negative, since rotate() indexes with it", () => {
    for (const s of ["", "a", "item-9999", "a very long topic line about succession depth"]) {
      expect(stableSeed(s)).toBeGreaterThanOrEqual(0);
    }
  });

  it("actually changes which samples are picked", () => {
    const many = Array.from({ length: 8 }, (_, i) => s(`id${i}`, "Lokesh", "post"));
    const a = pickSamples(many, { channel: "Lokesh", kind: "post", count: 3, seed: stableSeed("post-a") });
    const b = pickSamples(many, { channel: "Lokesh", kind: "post", count: 3, seed: stableSeed("post-b") });
    expect(a.map((x) => x.id)).not.toEqual(b.map((x) => x.id));
  });
});

describe("how many samples reach a prompt", () => {
  // Pinned rather than read from the constant: this is a dial with a real failure
  // mode on either side. Too few and the model has no sense of the writer's
  // range; too many and it starts collaging their actual phrases instead of
  // learning their rhythm. Changing it should be a deliberate edit with a reason.
  it("hands over eight, the current setting of the corpus-width dial", () => {
    expect(DEFAULT_SAMPLE_COUNT).toBe(8);
  });

  it("hands over the full count when that many are available", () => {
    const many = Array.from({ length: 22 }, (_, i) => s(`id${i}`, "Lokesh", "post"));
    expect(pickSamples(many, { channel: "Lokesh", kind: "post" })).toHaveLength(DEFAULT_SAMPLE_COUNT);
  });

  it("hands over what exists when the corpus is smaller than the count", () => {
    const few = [s("a", "Lokesh", "post"), s("b", "Lokesh", "post")];
    expect(pickSamples(few, { channel: "Lokesh", kind: "post" })).toHaveLength(2);
  });

  it("still reaches a post-only corpus from the deck path", () => {
    // Decks ask for slide samples. Nobody has pasted slide copy, so the tiering
    // has to fall through to that person's posts rather than returning nothing.
    const posts = Array.from({ length: 22 }, (_, i) => s(`id${i}`, "Lokesh", "post"));
    const picked = pickSamples(posts, { channel: "Lokesh", kind: "slide" });
    expect(picked).toHaveLength(DEFAULT_SAMPLE_COUNT);
    expect(picked.every((p) => p.channel === "Lokesh")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The corpus gate.
//
// This file exists because the app once learned its voice from its own output.
// The Konverz month plan in lib/konverzTemplate.ts looks exactly like the Kognoz
// one and is exactly as seedable — except its copy was written by a model. Wiring
// it in would rebuild the loop with extra steps, so the seeder reads the Kognoz
// plan and only the Kognoz plan.
// ---------------------------------------------------------------------------
describe("only human-written copy seeds the corpus", () => {
  it("samplesFromTemplate reads the Kognoz plan and never the Konverz one", () => {
    const seeded = samplesFromTemplate();
    expect(seeded.length).toBeGreaterThan(0);

    const konverzCopy = new Set(
      KONVERZ_PLAN_TEMPLATE.map((i) => (i.copy || "").trim()).filter((t) => t.length >= MIN_SAMPLE_CHARS)
    );
    expect(konverzCopy.size, "the Konverz plan does carry seedable-looking copy").toBeGreaterThan(0);
    for (const s of seeded) {
      expect(konverzCopy.has(s.text), `seeded a Konverz post: ${s.text.slice(0, 60)}`).toBe(false);
      expect(s.channel, "seeded a non-Kognoz channel").not.toBe("Konverz page");
    }
  });

  // Validation spans both brands even though seeding does not: a sample saved
  // under "Konverz page" has to survive being read while Kognoz is loaded, or a
  // save after a brand switch silently drops half the corpus.
  it("a Konverz sample survives coerceSamples", () => {
    const text = "x".repeat(MIN_SAMPLE_CHARS + 10);
    const [out] = coerceSamples([{ channel: "Konverz page", kind: "post", text, addedAt: new Date().toISOString() }]);
    expect(out?.channel).toBe("Konverz page");
    expect(isChannelId("Konverz page")).toBe(true);
    expect(isChannelId("Konverze page")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pasting several posts at once.
//
// The corpus is the strongest lever on whether copy reads as human, and the
// thing most likely to keep it empty is friction: paste, pick a channel, save,
// repeat six times. One box that takes six posts separated by blank lines is the
// whole feature.
// ---------------------------------------------------------------------------
describe("splitPastedSamples", () => {
  const long = (n: number) => `Post ${n}. ` + "Real sentences carrying a real thought about hiring. ".repeat(4);
  const fields = { channel: "Kognoz page" as const, kind: "post" as const };

  it("files one sample per blank-line-separated post", () => {
    const { samples, skipped } = splitPastedSamples([long(1), long(2), long(3)].join("\n\n"), fields);
    expect(samples).toHaveLength(3);
    expect(skipped).toBe(0);
    expect(samples[1].text).toContain("Post 2");
  });

  it("handles a single post with no blank lines at all", () => {
    const { samples } = splitPastedSamples(long(1), fields);
    expect(samples).toHaveLength(1);
  });

  it("keeps line breaks WITHIN a post — paragraphing is part of the voice", () => {
    const withBreaks = `${long(1)}\nA second line of the same post.`;
    const { samples } = splitPastedSamples(withBreaks, fields);
    expect(samples).toHaveLength(1);
    expect(samples[0].text).toContain("\nA second line");
  });

  it("drops pieces too short to teach anything, and counts them", () => {
    const { samples, skipped } = splitPastedSamples([long(1), "see more", long(2)].join("\n\n"), fields);
    expect(samples).toHaveLength(2);
    expect(skipped).toBe(1);
  });

  it("tolerates ragged spacing between posts", () => {
    const { samples } = splitPastedSamples(`${long(1)}\n   \n\n${long(2)}`, fields);
    expect(samples).toHaveLength(2);
  });

  it("returns nothing rather than throwing on empty input", () => {
    expect(splitPastedSamples("", fields)).toEqual({ samples: [], skipped: 0 });
    expect(splitPastedSamples("   \n\n  ", fields)).toEqual({ samples: [], skipped: 0 });
  });

  it("carries the chosen channel and kind onto every sample", () => {
    const { samples } = splitPastedSamples([long(1), long(2)].join("\n\n"), {
      channel: "Konverz page",
      kind: "slide",
      addedBy: "someone@example.com"
    });
    expect(samples.every((s) => s.channel === "Konverz page" && s.kind === "slide")).toBe(true);
    expect(samples[0].addedBy).toBe("someone@example.com");
  });

  it("mergeSamples then drops any that are already saved", () => {
    const { samples } = splitPastedSamples([long(1), long(2)].join("\n\n"), fields);
    const merged = mergeSamples([samples[0]], samples);
    expect(merged).toHaveLength(2);
  });
});
