import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { humanizeDeck, humanizeNote, humanizePlanTopics, humanizeText, MAX_ROUNDS, type DeckContent } from "./humanizePass";
import { KOGNOZ, KONVERZ } from "./brands";

// The governing rule for this module: a failed second pass must never cost the
// first. The draft is already paid for and already usable, so every failure path
// has to hand it back untouched rather than throw. These tests are that rule.

let bodies: any[] = [];

function mockFetch(replies: Array<{ text?: string; status?: number }>) {
  let i = 0;
  global.fetch = vi.fn(async (_url: any, init: any) => {
    bodies.push(JSON.parse(init.body));
    const r = replies[Math.min(i, replies.length - 1)];
    i += 1;
    if (r.status && r.status >= 400) {
      return {
        ok: false,
        status: r.status,
        headers: { get: () => null },
        json: async () => ({ error: "boom" })
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ content: [{ type: "text", text: r.text }], stop_reason: "end_turn" })
    };
  }) as any;
}

const deck = (): DeckContent => ({
  eyebrow: "Behavioral Signal",
  cover: "Culture is what people *do*",
  slides: [
    { title: "The survey and the logs disagree", body: "The score said ownership. The logs said otherwise." },
    { title: "Behaviour is the honest data", body: "What people report and what they do are different facts." }
  ],
  cta: "See how we read it"
});

beforeEach(() => {
  bodies = [];
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("humanizeDeck", () => {
  it("applies a well-formed rewrite", async () => {
    mockFetch([
      {
        text: JSON.stringify({
          cover: "Culture is what people *do*",
          slides: [
            { title: "The survey and the logs disagree", body: "The score said ownership. The logs did not." },
            { title: "Behaviour is the honest record", body: "Reported and observed are different facts." }
          ],
          cta: "See how we read it"
        })
      }
    ]);
    const r = await humanizeDeck(deck());
    expect(r.applied).toBe(true);
    expect(r.value.slides[1].title).toBe("Behaviour is the honest record");
  });

  it("keeps the draft when the pass changes the slide count", async () => {
    mockFetch([{ text: JSON.stringify({ cover: "x", slides: [{ title: "only one", body: "b" }], cta: "c" }) }]);
    const r = await humanizeDeck(deck());
    expect(r.applied).toBe(false);
    expect(r.value).toEqual(deck());
    expect(r.note).toMatch(/slide count/);
  });

  it("keeps the draft when the call fails outright", async () => {
    mockFetch([{ status: 400 }]);
    const r = await humanizeDeck(deck());
    expect(r.applied).toBe(false);
    expect(r.value).toEqual(deck());
  });

  it("keeps the draft when the reply is not JSON at all", async () => {
    mockFetch([{ text: "sorry, here is some prose instead" }]);
    const r = await humanizeDeck(deck());
    expect(r.applied).toBe(false);
    expect(r.value).toEqual(deck());
  });

  it("falls back field by field when the reply drops one", async () => {
    mockFetch([
      {
        text: JSON.stringify({
          cover: "",
          slides: [{ title: "Kept claim", body: "" }, { title: "", body: "New body." }],
          cta: "New close"
        })
      }
    ]);
    const r = await humanizeDeck(deck());
    expect(r.applied).toBe(true);
    expect(r.value.cover).toBe(deck().cover); // empty string never overwrites
    expect(r.value.slides[0].title).toBe("Kept claim");
    expect(r.value.slides[0].body).toBe(deck().slides[0].body);
    expect(r.value.slides[1].title).toBe(deck().slides[1].title);
    expect(r.value.slides[1].body).toBe("New body.");
  });

  it("never lets the pass change the eyebrow", async () => {
    mockFetch([
      { text: JSON.stringify({ eyebrow: "Something Else", cover: "c", slides: deck().slides, cta: "x" }) }
    ]);
    const r = await humanizeDeck(deck());
    expect(r.value.eyebrow).toBe("Behavioral Signal");
  });

  it("sends the linter's findings to the model", async () => {
    mockFetch([{ text: JSON.stringify({ cover: "c", slides: deck().slides, cta: "x" }) }]);
    const dirty = deck();
    dirty.slides[0].body = "We will unlock the journey here.";
    await humanizeDeck(dirty);
    expect(bodies[0].prompt).toMatch(/unlock/);
    expect(bodies[0].prompt).toMatch(/Fix every one of these/);
  });

  it("reports the task as humanize so the route applies its own model and thinking", async () => {
    mockFetch([{ text: JSON.stringify({ cover: "c", slides: deck().slides, cta: "x" }) }]);
    await humanizeDeck(deck());
    expect(bodies[0].task).toBe("humanize");
  });
});

describe("humanizeText", () => {
  const draft =
    "A client's engagement survey said people felt ownership. Their decision logs said otherwise. " +
    "Choices that belonged with managers were travelling two levels up before anyone would commit.";

  it("applies a rewrite of a reasonable length", async () => {
    const rewritten =
      "The engagement survey said people felt ownership. The decision logs disagreed. " +
      "Choices that belonged with managers were climbing two levels before anyone would commit to them.";
    mockFetch([{ text: rewritten }]);
    const r = await humanizeText(draft);
    expect(r.applied).toBe(true);
    expect(r.value).toBe(rewritten);
  });

  it("keeps the draft when the pass summarises instead of editing", async () => {
    mockFetch([{ text: "Surveys lie." }]);
    const r = await humanizeText(draft);
    expect(r.applied).toBe(false);
    expect(r.value).toBe(draft);
    expect(r.note).toMatch(/far less text/);
  });

  it("keeps the draft when the call fails", async () => {
    mockFetch([{ status: 400 }]);
    const r = await humanizeText(draft);
    expect(r.applied).toBe(false);
    expect(r.value).toBe(draft);
  });

  it("scores the draft before and the result after", async () => {
    mockFetch([{ text: draft.replace("otherwise", "the opposite") }]);
    const r = await humanizeText("We will unlock the journey. " + draft);
    expect(r.before.score).toBeLessThan(100);
  });
});

describe("humanizePlanTopics", () => {
  const items = [
    { day: 1, channel: "Lokesh", format: "Text post", pillar: "Behavioral Signal", topic: "First topic line here" },
    { day: 2, channel: "Harpreet", format: "Carousel", pillar: "Consulting POV", topic: "Second topic line here" }
  ];

  it("takes only the topic strings from the reply", async () => {
    mockFetch([
      {
        text: JSON.stringify({
          items: [
            { day: 99, channel: "Nobody", format: "Poll", pillar: "Wrong", topic: "Rewritten first" },
            { day: 98, channel: "Nobody", format: "Poll", pillar: "Wrong", topic: "Rewritten second" }
          ]
        })
      }
    ]);
    const r = await humanizePlanTopics(items);
    expect(r.applied).toBe(true);
    expect(r.value[0]).toEqual({ ...items[0], topic: "Rewritten first" });
    expect(r.value[1].day).toBe(2);
    expect(r.value[1].channel).toBe("Harpreet");
  });

  it("keeps the plan when the count changes", async () => {
    mockFetch([{ text: JSON.stringify({ items: [{ topic: "only one" }] }) }]);
    const r = await humanizePlanTopics(items);
    expect(r.applied).toBe(false);
    expect(r.value).toEqual(items);
    expect(r.note).toMatch(/number of posts/);
  });

  it("keeps the plan when the call fails", async () => {
    mockFetch([{ status: 500 }, { status: 500 }]);
    const r = await humanizePlanTopics(items);
    expect(r.applied).toBe(false);
    expect(r.value).toEqual(items);
  });

  it("does nothing with an empty plan and makes no call", async () => {
    mockFetch([{ text: "{}" }]);
    const r = await humanizePlanTopics([]);
    expect(r.applied).toBe(false);
    expect(bodies).toHaveLength(0);
  });
});

describe("humanizeNote", () => {
  const report = (score: number) => ({ score, findings: [] });

  it("names the improvement when the score rises", () => {
    expect(humanizeNote({ value: 1, draft: 1, before: report(70), after: report(90), applied: true })).toMatch(/70 to 90/);
  });

  it("says so plainly when the score held", () => {
    expect(humanizeNote({ value: 1, draft: 1, before: report(88), after: report(88), applied: true })).toMatch(/held at 88/);
  });

  it("does not hide a pass that made things worse", () => {
    expect(humanizeNote({ value: 1, draft: 1, before: report(90), after: report(80), applied: true })).toMatch(/90 to 80/);
  });

  it("explains a skip", () => {
    expect(humanizeNote({ value: 1, draft: 1, before: report(90), after: report(90), applied: false, note: "it broke" })).toBe(
      "Edit pass skipped: it broke."
    );
  });
});

// The draft is returned alongside the result so the UI can show what the edit
// pass changed and offer to keep the original wording of a single slide.
describe("the draft comes back for diffing", () => {
  it("returns what went in when the pass applied", async () => {
    const rewritten = {
      cover: "Culture is what people *do*",
      slides: [
        { title: "The survey and the logs disagree", body: "The score said ownership. The logs did not." },
        { title: "Behaviour is the honest record", body: "Reported and observed are different facts." }
      ],
      cta: "See how we read it"
    };
    mockFetch([{ text: JSON.stringify(rewritten) }]);
    const original = deck();
    const r = await humanizeDeck(original);
    expect(r.draft).toEqual(original);
    expect(r.value).not.toEqual(original);
  });

  it("returns draft equal to value when the pass was skipped", async () => {
    mockFetch([{ status: 400 }]);
    const r = await humanizeDeck(deck());
    expect(r.draft).toEqual(r.value);
  });

  it("does the same for text", async () => {
    const draft = "A first sentence that is long enough to survive the length guard on this pass.";
    mockFetch([{ text: "A rewritten sentence that is also long enough to survive the length guard here." }]);
    const r = await humanizeText(draft);
    expect(r.draft).toBe(draft);
    expect(r.value).not.toBe(draft);
  });
});

// ---------------------------------------------------------------------------
// The brand reaches BOTH halves of the pass.
//
// The prompt and the linter must be measuring the same thing. If the draft is
// linted against the shared list while the prompt quotes a filtered one, a
// Konverz draft arrives at the editor carrying findings for "journey" — a word
// its own canon is built on — and the edit pass spends its single turn removing
// accurate product language.
// ---------------------------------------------------------------------------
describe("brand plumbing", () => {
  it("does not report the brand's own vocabulary as a problem", async () => {
    mockFetch([{ text: "The hire journey runs from screening to offer. Recruiters still decide." }]);
    const draft = "The hire journey runs screening to offer. It elevates what a recruiter sees.";

    const konverz = await humanizeText(draft, { brand: KONVERZ });
    expect(konverz.before.findings.some((f) => f.rule === "banned-phrase")).toBe(false);
    // And the findings block it sent carries no complaint about those words.
    expect(JSON.stringify(bodies.at(-1))).not.toMatch(/banned phrase "journey"/i);

    bodies = [];
    mockFetch([{ text: "The hire journey runs from screening to offer. Recruiters still decide." }]);
    const kognoz = await humanizeText(draft, { brand: KOGNOZ });
    expect(kognoz.before.findings.some((f) => f.rule === "banned-phrase")).toBe(true);
  });

  it("tells the editor which brand it is editing for", async () => {
    mockFetch([{ text: "A rewritten line that is comfortably long enough to survive the length check." }]);
    await humanizeText("A drafted line that is comfortably long enough to survive the length check.", {
      brand: KONVERZ,
      channel: "Konverz page"
    });
    const sent = JSON.stringify(bodies.at(-1));
    expect(sent).toContain("Konverz AI");
  });

  it("defaults to Kognoz, so an unthreaded caller is unchanged", async () => {
    mockFetch([{ text: "A rewritten line that is comfortably long enough to survive the length check." }]);
    await humanizeText("A drafted line that is comfortably long enough to survive the length check.");
    expect(JSON.stringify(bodies.at(-1))).toContain("Kognoz");
  });

  it("a failed pass still returns the draft untouched, whichever brand", async () => {
    mockFetch([{ status: 500 }]);
    const draft: DeckContent = { cover: "A *cover*", slides: [{ title: "t", body: "b" }], cta: "cta" };
    const r = await humanizeDeck(draft, { brand: KONVERZ });
    expect(r.applied).toBe(false);
    expect(r.value).toBe(draft);
  });
});

// ---------------------------------------------------------------------------
// The re-edit loop.
//
// One pass got one attempt and never read its own output — `after` was computed
// and then only printed. Now a rewrite that still reads machine-made buys one
// more round. The rules that keep that from costing anything:
//
//   the draft is never lost      every exit returns an edit or the original
//   the best round wins          not the last; round two can come out worse
//   round one always beats the   the score cannot see a concrete scene replacing
//   draft                        an abstraction, which is most of the job
//   two rounds, hard             the third trades accuracy for novelty
// ---------------------------------------------------------------------------
describe("the re-edit loop", () => {
  const dirty = "We unlock seamless hiring. We unlock seamless hiring outcomes for every single team.";

  it("stops after one round when the rewrite comes back clean", async () => {
    mockFetch([{ text: "The pile was the bottleneck. Screening now takes two minutes." }]);
    const r = await humanizeText(dirty);
    expect(r.rounds).toBe(1);
    expect(bodies).toHaveLength(1);
    expect(r.applied).toBe(true);
  });

  it("goes round again when the rewrite is still machine-made, and stops at two", async () => {
    // Both replies keep a banned phrase, so `stillWrong` holds throughout and the
    // only thing that ends the loop is MAX_ROUNDS.
    mockFetch([{ text: "We still unlock seamless outcomes across the whole hiring funnel here." }]);
    const r = await humanizeText(dirty);
    expect(r.rounds).toBe(MAX_ROUNDS);
    expect(bodies).toHaveLength(MAX_ROUNDS);
  });

  it("feeds each round the faults left by the one before it", async () => {
    mockFetch([{ text: "We still unlock seamless outcomes across the whole hiring funnel here." }]);
    await humanizeText(dirty);
    const second = JSON.stringify(bodies[1]);
    // Round two is editing round one's OUTPUT, not the original draft.
    expect(second).toContain("We still unlock seamless outcomes");
    expect(second).toMatch(/PROBLEMS FOUND IN THE DRAFT/);
  });

  it("keeps the better of two rounds, not the later one", async () => {
    // Round 1 comes back clean; round 2 would be worse. The loop should not even
    // ask for round 2 here — and if it ever did, the better one still wins.
    mockFetch([
      { text: "Screening took eleven weeks. It takes two minutes now, and a recruiter still decides." },
      { text: "We unlock seamless synergy. We unlock seamless synergy. We unlock seamless synergy." }
    ]);
    const r = await humanizeText(dirty);
    expect(r.value).toContain("eleven weeks");
    expect(r.value).not.toContain("synergy");
  });

  it("a round that fails mid-loop keeps what the earlier round produced", async () => {
    mockFetch([
      { text: "We still unlock seamless outcomes across the whole hiring funnel here." },
      { status: 500 }
    ]);
    const r = await humanizeText(dirty);
    expect(r.applied).toBe(true);
    expect(r.rounds).toBe(1);
    expect(r.value).toContain("hiring funnel");
    expect(r.value).not.toBe(dirty);
  });

  // The rule the whole file is built on, under the new control flow.
  it("a FIRST round that fails still costs the draft nothing", async () => {
    mockFetch([{ status: 500 }]);
    const r = await humanizeText(dirty);
    expect(r.applied).toBe(false);
    expect(r.value).toBe(dirty);
    expect(r.rounds).toBe(0);
  });

  it("an already-clean draft still gets its edit kept, even though the score cannot rise", async () => {
    // The regression this caught: comparing scores from round one discarded every
    // edit to copy that was already lint-clean, which is most good drafts.
    const clean = "Screening took eleven weeks. Two minutes now. A recruiter still makes the call on every one.";
    const edited = "Eleven weeks of screening. Two minutes now. The recruiter still decides, on every single one.";
    mockFetch([{ text: edited }]);
    const r = await humanizeText(clean);
    expect(r.before.score).toBe(100);
    expect(r.value).toBe(edited);
    expect(r.applied).toBe(true);
  });

  it("the deck path loops on the same terms and never changes the slide count", async () => {
    const draft: DeckContent = {
      cover: "We *unlock* seamless hiring",
      slides: [
        { title: "One", body: "We unlock seamless hiring across the funnel." },
        { title: "Two", body: "We unlock seamless hiring across the funnel." }
      ],
      cta: "Book a demo"
    };
    mockFetch([
      {
        text: JSON.stringify({
          cover: "We *unlock* seamless hiring",
          slides: [
            { title: "One", body: "We unlock seamless outcomes still." },
            { title: "Two", body: "We unlock seamless outcomes still." }
          ],
          cta: "Book a demo"
        })
      }
    ]);
    const r = await humanizeDeck(draft);
    expect(r.rounds).toBe(MAX_ROUNDS);
    expect(r.value.slides).toHaveLength(2);
    expect(r.value.eyebrow).toBe(draft.eyebrow);
  });

  it("names the round count in the note, so a thin corpus is visible", async () => {
    mockFetch([{ text: "We still unlock seamless outcomes across the whole hiring funnel here." }]);
    const r = await humanizeText(dirty);
    expect(humanizeNote(r)).toContain("over 2 passes");
  });
});
