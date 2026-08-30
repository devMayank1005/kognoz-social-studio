import { describe, it, expect } from "vitest";
import { buildGeneratePrompt } from "./promptBuilders";
import { DEFAULT_BUDGET } from "./coerce";
import { STUDIO_FORMATS, FORMATS, FORMAT_BRIEF, SLIDE_SLOTS, bodyBudgetFor } from "./formats";
import type { FormatId } from "./formats";

// Prompts were entirely untested. Video Kinetic returned 2-3 lines because its
// prompt asked for "one supporting line, max ~140 chars" — nothing was broken, the
// contract said to write almost nothing. These lock the contracts in place.

const promptFor = (format: FormatId) =>
  buildGeneratePrompt({ topic: "Human and AI work transformation", pillar: "Human + AI", format }).prompt;

/** Every "max ~N chars" budget the prompt asks Claude for. */
const askedBudgets = (p: string) =>
  Array.from(p.matchAll(/max ~(\d+)\s*char/gi), (m) => Number(m[1]));

describe("every format still produces a prompt", () => {
  it("builds for all studio formats without throwing", () => {
    for (const f of STUDIO_FORMATS) expect(promptFor(f).length).toBeGreaterThan(200);
  });

  it("names the topic and pillar in each", () => {
    for (const f of STUDIO_FORMATS) {
      const p = promptFor(f);
      expect(p).toContain("Human and AI work transformation");
      expect(p).toContain("Human + AI");
    }
  });
});

describe("the trap: asking for more than coerceContent will keep", () => {
  it("never requests a body longer than that format's budget will keep", () => {
    // Raising a prompt budget above the clamp is silently pointless — the extra
    // characters are cut in coerceContent with no error and no signal. This test
    // caught exactly that: Story asked for 420 against a 230 default.
    for (const f of STUDIO_FORMATS) {
      const ceiling = Math.max(bodyBudgetFor(f), DEFAULT_BUDGET.cta);
      for (const n of askedBudgets(promptFor(f))) {
        expect({ format: f, asked: n, ceiling }).toMatchObject({ asked: expect.any(Number) });
        expect(n).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  it("keeps Founder Video's caption within the cta budget", () => {
    // This one was live-broken: a ~280 char caption clamped to 110 lost ~60%.
    const asked = askedBudgets(promptFor("Founder Video"));
    expect(Math.max(...asked)).toBeLessThanOrEqual(DEFAULT_BUDGET.cta);
  });
});

describe("the four formats that were producing empty pages", () => {
  it("Video Kinetic asks for a sequence of beats, not one line", () => {
    const p = promptFor("Video");
    expect(p).toMatch(/exactly 4 slides/i);
    expect(p).toMatch(/sequence/i);
    // The old contract, which is what produced 2-3 lines.
    expect(p).not.toMatch(/then one supporting line appears/i);
  });

  it("Montage asks for one complete argument across its 3 frames", () => {
    const p = promptFor("Montage");
    expect(p).toMatch(/exactly 3 slides/i);
    expect(p).toMatch(/COMPLETE argument/i);
    // "standalone point" is what produced three disconnected fragments.
    expect(p).not.toMatch(/standalone point/i);
  });

  it("Article Cover asks for a standfirst instead of a placeholder hyphen", () => {
    const p = promptFor("Article Cover");
    expect(p).toMatch(/standfirst/i);
    expect(p).toMatch(/16:9/);
  });

  it("Story asks for an arc rather than one stray idea", () => {
    const p = promptFor("Story");
    expect(p).toMatch(/hook/i);
    expect(p).not.toMatch(/one supporting idea/i);
  });
});

describe("prompt slide counts match what the renderer draws", () => {
  const asksExactly = (p: string) => {
    const m = p.match(/exactly (\d+) slides/i);
    return m ? Number(m[1]) : null;
  };

  it("never asks for more slides than the format has slots", () => {
    for (const f of STUDIO_FORMATS) {
      const spec = FORMATS[f];
      if (!spec.single) continue;
      const asked = asksExactly(promptFor(f));
      if (asked === null) continue;
      expect(asked).toBeLessThanOrEqual(SLIDE_SLOTS[spec.single]);
    }
  });

  it("gives Video and Article the slots their new prompts need", () => {
    expect(SLIDE_SLOTS.video).toBeGreaterThanOrEqual(4);
    expect(SLIDE_SLOTS.article).toBeGreaterThanOrEqual(1);
  });
});

describe("FORMAT_BRIEF — what the user is told before spending credit", () => {
  it("describes every format the picker offers", () => {
    for (const f of STUDIO_FORMATS) {
      expect(FORMAT_BRIEF[f]).toBeTruthy();
      expect(FORMAT_BRIEF[f].length).toBeGreaterThan(10);
    }
  });
});
