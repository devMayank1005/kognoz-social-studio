import { describe, it, expect } from "vitest";
import {
  BANNED_PHRASES,
  bannedFor,
  MIN_LENGTH_VARIATION,
  formatFindings,
  lengthVariation,
  lintContent,
  lintSegments,
  lintText,
  lintTopics,
  normalizeQuotes,
  sentencesOf
} from "./slopLint";

const rules = (r: { findings: { rule: string }[] }) => r.findings.map((f) => f.rule);

describe("sentencesOf", () => {
  it("splits on terminators and line breaks", () => {
    expect(sentencesOf("One thing. Two things.\nThree things")).toEqual([
      "One thing.",
      "Two things.",
      "Three things"
    ]);
  });

  it("does not split a decimal number", () => {
    expect(sentencesOf("Latency fell 3.5x this quarter.")).toEqual(["Latency fell 3.5x this quarter."]);
  });

  it("does not split mid-word on an abbreviation", () => {
    expect(sentencesOf("Ask the C.E.O. today.")).toEqual(["Ask the C.E.O. today."]);
  });

  it("returns nothing for empty input", () => {
    expect(sentencesOf("   ")).toEqual([]);
    expect(sentencesOf("")).toEqual([]);
  });
});

describe("lengthVariation", () => {
  it("is null below six sentences", () => {
    expect(lengthVariation("One. Two. Three.")).toBeNull();
  });

  it("does not flag real human copy from the editorial plan", () => {
    // lib/calendarTemplate.ts item 23, written by a person.
    const human =
      "Yesterday's deck asked which of five behaviors was the early warning. " +
      "Most answers picked the loud one, the conflict in the room. " +
      "The signal was the quiet one, the meeting where dissent stopped showing up. " +
      "Conflict means people still believe the room can change something. " +
      "Silence means they have stopped trying. " +
      "Silence arrives before attrition does, usually by two quarters. " +
      "That gap is where retention is won.";
    const cv = lengthVariation(human);
    expect(cv).not.toBeNull();
    expect(cv as number).toBeGreaterThan(MIN_LENGTH_VARIATION);
  });

  it("flags text where every sentence is the same length", () => {
    const metronome = Array.from({ length: 7 }, (_, i) => `Alpha beta gamma delta epsilon ${i}.`).join(" ");
    const cv = lengthVariation(metronome);
    expect(cv as number).toBeLessThan(MIN_LENGTH_VARIATION);
  });
});

describe("lexical rules", () => {
  it("catches every banned phrase in the list", () => {
    for (const phrase of BANNED_PHRASES) {
      const report = lintText(`We ${phrase} here and there.`);
      expect(rules(report), `expected "${phrase}" to be caught`).toContain("banned-phrase");
    }
  });

  it("matches a banned phrase written with a curly apostrophe", () => {
    expect(rules(lintText("This isn’t just a tooling change."))).toContain("banned-phrase");
  });

  it("catches inflected forms of a banned word", () => {
    for (const s of ["unlocks", "unlocked", "unlocking", "leveraging", "leveraged", "delving", "navigating", "elevates", "fostering", "harnessing"]) {
      expect(rules(lintText(`The team is ${s} value.`)), `expected "${s}" to be caught`).toContain("banned-phrase");
    }
  });

  it("does not fire on a word that merely contains a banned phrase", () => {
    for (const s of ["diverse", "navigation", "divided", "diver", "forest", "realmless"]) {
      expect(rules(lintText(`Their ${s} is fine.`)), `did not expect "${s}" to be caught`).not.toContain(
        "banned-phrase"
      );
    }
  });

  it("catches em and en dashes", () => {
    expect(rules(lintText("Culture is behaviour — not opinion."))).toContain("dash");
    expect(rules(lintText("Two things – both true."))).toContain("dash");
  });

  it("catches emoji, exclamations and hashtags", () => {
    expect(rules(lintText("Great result 🎯"))).toContain("emoji");
    expect(rules(lintText("This works!"))).toContain("exclamation");
    expect(rules(lintText("Read more #leadership"))).toContain("hashtag");
  });

  it("catches hedging", () => {
    expect(rules(lintText("We believe the structure is the cause."))).toContain("hedging");
  });

  it("catches a rhetorical question opener in a body but not in a headline", () => {
    expect(rules(lintSegments([{ where: "b", text: "What if culture is behaviour? It is.", role: "body" }]))).toContain(
      "question-hook"
    );
    expect(
      rules(lintSegments([{ where: "h", text: "What if culture is behaviour?", role: "headline" }]))
    ).not.toContain("question-hook");
  });

  it("catches a colon headline only in a headline", () => {
    expect(rules(lintSegments([{ where: "h", text: "Succession: the myth of readiness", role: "headline" }]))).toContain(
      "colon-headline"
    );
    expect(rules(lintSegments([{ where: "b", text: "Succession: the myth of readiness", role: "body" }]))).not.toContain(
      "colon-headline"
    );
  });

  it("catches balanced not-X-but-Y framing", () => {
    expect(rules(lintText("This is not a training problem, it is a structure problem."))).toContain("symmetry");
  });

  it("catches a rhythm tricolon", () => {
    expect(rules(lintText("They want teams that are faster, smarter and cheaper."))).toContain("tricolon");
  });

  it("passes clean copy", () => {
    const report = lintText(
      "A client's engagement survey said people felt ownership. Their decision logs said otherwise. " +
        "Choices that belonged with managers were travelling two levels up before anyone would commit."
    );
    expect(report.findings).toEqual([]);
    expect(report.score).toBe(100);
  });
});

describe("structural rules", () => {
  it("flags repeated sentence openers across slides", () => {
    const report = lintSegments([
      { where: "slide 1", text: "The survey says people feel ownership.", role: "body" },
      { where: "slide 2", text: "The survey says decisions move upward.", role: "body" }
    ]);
    expect(rules(report)).toContain("repeated-opener");
  });

  it("flags four slides that are all the same length", () => {
    const body = "Decision rights sat two levels above the work being done here.";
    const report = lintSegments(
      [1, 2, 3, 4].map((i) => ({ where: `slide ${i}`, text: body.replace("here", `case ${i}`), role: "body" as const }))
    );
    expect(rules(report)).toContain("uniform-segment-length");
  });

  it("does not flag segment length when slides genuinely vary", () => {
    const report = lintSegments([
      { where: "slide 1", text: "Short.", role: "body" },
      { where: "slide 2", text: "A middling body that carries one observed behaviour and stops.", role: "body" },
      { where: "slide 3", text: "Longer again, with a number attached and a second clause that keeps going for a while yet.", role: "body" },
      { where: "slide 4", text: "Two words.", role: "body" }
    ]);
    expect(rules(report)).not.toContain("uniform-segment-length");
  });
});

describe("scoring", () => {
  it("scores clean copy at 100 and dirty copy lower", () => {
    expect(lintText("Decisions travelled upward before anyone would commit.").score).toBe(100);
    const dirty = lintText("Let's unlock the journey — it isn't just seamless, it's about synergy!");
    expect(dirty.score).toBeLessThan(60);
  });

  it("never goes below zero", () => {
    const awful = lintText(BANNED_PHRASES.join(". ") + " — we believe! 🎯 #tag");
    expect(awful.score).toBeGreaterThanOrEqual(0);
  });

  it("caps how many findings one rule contributes", () => {
    const report = lintText("unlock leverage seamless journey navigate delve robust");
    const banned = report.findings.filter((f) => f.rule === "banned-phrase");
    expect(banned.length).toBeLessThanOrEqual(3);
  });

  it("sorts the most severe findings first", () => {
    const report = lintText("We believe this unlocks value.");
    expect(report.findings[0].severity).toBe("high");
  });
});

describe("entry points", () => {
  it("lintContent labels where a problem is", () => {
    const report = lintContent({
      cover: "Unlock the *culture* signal",
      slides: [{ title: "A clear claim here", body: "Behaviour, plainly stated." }],
      cta: "See how we read it"
    });
    const banned = report.findings.find((f) => f.rule === "banned-phrase");
    expect(banned?.where).toBe("cover");
  });

  it("lintTopics labels each topic", () => {
    const report = lintTopics(["A fine topic line", "Another that will delve into things"]);
    expect(report.findings.find((f) => f.rule === "banned-phrase")?.where).toBe("topic 2");
  });

  it("formatFindings returns empty string when clean", () => {
    expect(formatFindings(lintText("Decisions travelled upward."))).toBe("");
  });

  it("formatFindings lists the problems when dirty", () => {
    const out = formatFindings(lintText("We will unlock it."));
    expect(out).toContain("unlock");
    expect(out).toContain("Fix every one of these");
  });
});

describe("normalizeQuotes", () => {
  it("folds curly quotes to straight", () => {
    expect(normalizeQuotes("it’s “fine”")).toBe(`it's "fine"`);
  });
});

// ---------------------------------------------------------------------------
// Per-brand exemptions.
//
// The list stays shared; what changes is which of it applies. Konverz's canon is
// built on the Hire/Nurture/Coach/Learn JOURNEYS, there is a format called
// Journey Map, and the deck tagline is "Elevating Talent Decisions". Both words
// are on the shared banned list. Without the exemption, every accurate Konverz
// piece is flagged as slop, the humanize pass is handed non-problems to fix, and
// the style score stops meaning anything for the brand.
// ---------------------------------------------------------------------------
describe("brand exemptions", () => {
  const KONVERZ_ALLOWED = { allowed: ["journey", "elevate"] };
  const line = "The hire journey runs screening to offer. It elevates what a recruiter sees.";

  it("flags the words for a brand with no exemptions", () => {
    const rules = lintText(line).findings.filter((f) => f.rule === "banned-phrase");
    expect(rules.map((f) => f.evidence?.toLowerCase()).sort()).toEqual(["elevates", "journey"]);
  });

  it("does not flag them for a brand that exempts them", () => {
    const rules = lintText(line, "text", KONVERZ_ALLOWED).findings.filter((f) => f.rule === "banned-phrase");
    expect(rules).toEqual([]);
  });

  it("still flags everything else for the exempting brand", () => {
    // One word per call: findings are capped at MAX_PER_RULE per rule, and every
    // banned phrase shares the rule id, so a sentence carrying four of them only
    // ever reports three.
    for (const word of ["unlock", "seamless", "leverage", "holistic"]) {
      const found = lintText(`We ${word} the screening step.`, "text", KONVERZ_ALLOWED).findings.map((f) =>
        f.evidence?.toLowerCase()
      );
      expect(found, word).toContain(word);
    }
  });

  it("an exemption cannot ADD a ban — bannedFor only ever subtracts", () => {
    expect(bannedFor([]).length).toBe(BANNED_PHRASES.length);
    expect(bannedFor(["journey"]).length).toBe(BANNED_PHRASES.length - 1);
    // A phrase not on the list changes nothing rather than adding one.
    expect(bannedFor(["mechanism"]).length).toBe(BANNED_PHRASES.length);
    expect(bannedFor(["journey"])).not.toContain("journey");
  });

  it("the structural rules apply to both brands unchanged", () => {
    // Dashes, emoji and the balanced not-X-but-Y move are tells of machine
    // rhythm, not of vocabulary. No brand opts out of reading like a person.
    const dashy = "Screening is fast — and the panel is not.";
    for (const opts of [{}, KONVERZ_ALLOWED]) {
      expect(lintText(dashy, "text", opts).findings.map((f) => f.rule)).toContain("dash");
    }
  });

  it("lintContent and lintTopics take the exemption too", () => {
    const deck = { cover: "The hiring *journey*", slides: [{ title: "Stage one", body: "The journey starts at screening." }], cta: "Book a demo" };
    expect(lintContent(deck).findings.some((f) => f.rule === "banned-phrase")).toBe(true);
    expect(lintContent(deck, KONVERZ_ALLOWED).findings.some((f) => f.rule === "banned-phrase")).toBe(false);

    const topics = ["The hire journey, end to end"];
    expect(lintTopics(topics).findings.some((f) => f.rule === "banned-phrase")).toBe(true);
    expect(lintTopics(topics, KONVERZ_ALLOWED).findings.some((f) => f.rule === "banned-phrase")).toBe(false);
  });
});
