import { describe, it, expect } from "vitest";
import {
  MIN_PROBLEM_CHARS,
  SCAN_STALE_DAYS,
  coerceProblems,
  coerceScan,
  formatProblemsBlock,
  isScanStale,
  newProblem,
  scanAgeDays
} from "./marketScan";
import { buildMarketScanPrompt, buildCalendarPlanPrompt, wholePrompt } from "./promptBuilders";
import { KOGNOZ, KONVERZ } from "./brands";
import { coercePlan } from "./calendarPlan";

const problem = (over: Partial<ReturnType<typeof newProblem>> = {}) => ({
  problem: "Panels re-interview the same candidate because nobody trusts the first scorecard",
  who: "TA head, BFSI, high-volume RM hiring",
  evidence: "Median 3.2 interviews per shortlisted candidate",
  source: "Some Hiring Report, 2026",
  lane: "hire",
  ...over
});

describe("coerceProblems", () => {
  const lanes = Object.keys(KONVERZ.lanes);

  it("keeps a well-formed problem and gives it an id", () => {
    const [p] = coerceProblems([problem()], lanes);
    expect(p.id).toBeTruthy();
    expect(p.who).toContain("BFSI");
    expect(p.source).toContain("2026");
  });

  // Blob storage is schemaless and this list is hand-edited. One bad row must not
  // empty the list, which is the same rule coerceSamples follows.
  it("drops malformed rows without throwing", () => {
    const out = coerceProblems([problem(), null, "nope", 7, {}, { problem: "" }], lanes);
    expect(out).toHaveLength(1);
  });

  it("drops a fragment too short to be a problem", () => {
    expect(coerceProblems([problem({ problem: "hiring is hard" })], lanes)).toEqual([]);
    expect("hiring is hard".length).toBeLessThan(MIN_PROBLEM_CHARS);
  });

  // The planner would treat a duplicate as two subjects and write two posts.
  it("drops a problem already in the list, ignoring punctuation and case", () => {
    const out = coerceProblems(
      [problem(), problem({ problem: "PANELS RE-INTERVIEW the same candidate, because nobody trusts the first scorecard!" })],
      lanes
    );
    expect(out).toHaveLength(1);
  });

  it("pins an unknown lane to the brand's first rather than dropping the finding", () => {
    // The problem is still real; only its filing was wrong. Dropping it would
    // throw away research over a label.
    const [p] = coerceProblems([problem({ lane: "not-a-lane" })], lanes);
    expect(lanes).toContain(p.lane);
  });

  it("leaves the lane alone when no lane list is supplied", () => {
    const [p] = coerceProblems([problem({ lane: "whatever" })]);
    expect(p.lane).toBe("whatever");
  });

  it("keeps an unsourced problem, because the UI flags it rather than hiding it", () => {
    const [p] = coerceProblems([problem({ source: "" })], lanes);
    expect(p.source).toBe("");
  });
});

describe("coerceScan", () => {
  it("returns null for anything unusable, so the caller shows an empty state", () => {
    for (const bad of [null, undefined, 7, "x", {}, { problems: [] }, { problems: "no" }]) {
      expect(coerceScan(bad, "konverz")).toBeNull();
    }
  });

  it("reads back a saved scan", () => {
    const scan = coerceScan({ scannedAt: "2026-09-01T00:00:00.000Z", problems: [problem()] }, "konverz");
    expect(scan?.problems).toHaveLength(1);
    expect(scan?.brandId).toBe("konverz");
  });
});

describe("staleness", () => {
  const at = (iso: string) => ({ brandId: "konverz" as const, scannedAt: iso, problems: [] });
  const now = new Date("2026-09-16T12:00:00.000Z");

  it("counts whole days", () => {
    expect(scanAgeDays(at("2026-09-16T00:00:00.000Z"), now)).toBe(0);
    expect(scanAgeDays(at("2026-09-06T00:00:00.000Z"), now)).toBe(10);
  });

  it("treats a missing or unreadable date as stale rather than fresh", () => {
    // Fresh is the dangerous default: it lets an undated list pass as current.
    expect(isScanStale(null, now)).toBe(true);
    expect(isScanStale(at(""), now)).toBe(true);
    expect(isScanStale(at("not a date"), now)).toBe(true);
  });

  it("goes stale at the threshold", () => {
    const old = new Date(now.getTime() - SCAN_STALE_DAYS * 86_400_000).toISOString();
    const recent = new Date(now.getTime() - (SCAN_STALE_DAYS - 2) * 86_400_000).toISOString();
    expect(isScanStale(at(old), now)).toBe(true);
    expect(isScanStale(at(recent), now)).toBe(false);
  });
});

describe("formatProblemsBlock", () => {
  it("returns empty for an empty list, so the planner falls back rather than obeying nothing", () => {
    expect(formatProblemsBlock([])).toBe("");
  });

  it("numbers the problems and demands a topic trace back to one", () => {
    const block = formatProblemsBlock(coerceProblems([problem(), problem({ problem: "Campus offers lapse because the decision takes eleven days" })]));
    expect(block).toContain("1. Panels re-interview");
    expect(block).toContain("2. Campus offers lapse");
    expect(block).toMatch(/EVERY TOPIC MUST COME FROM ONE OF THESE/);
    expect(block).toMatch(/fromProblem/);
  });

  it("says plainly that a topic is not a restatement of the problem", () => {
    expect(formatProblemsBlock(coerceProblems([problem()]))).toMatch(/Do not restate a problem as a topic/);
  });
});

describe("buildMarketScanPrompt", () => {
  const scan = (brand = KONVERZ) => wholePrompt(buildMarketScanPrompt(brand));

  it("always grounds — an ungrounded scan is the thing it replaces", () => {
    expect(buildMarketScanPrompt(KONVERZ).useSearch).toBe(true);
  });

  it("asks for what somebody DOES, and refuses themes", () => {
    const p = scan();
    expect(p).toMatch(/Something a named kind of person DOES/);
    expect(p).toMatch(/Themes, trends, categories and shifts/);
    expect(p).toMatch(/conference track title/);
  });

  // The drift this guards: asked to research the market for a talent platform, a
  // model starts listing what such a platform would fix, and every topic planned
  // off the result becomes a feature post.
  it("forbids describing a product, including the brand's own", () => {
    expect(scan()).toMatch(/ANY DESCRIPTION OF A PRODUCT OR A SOLUTION, including this brand's/);
  });

  it("would rather have a short sourced list than a long assumed one", () => {
    const p = scan();
    expect(p).toMatch(/If you cannot source it, LEAVE IT OUT/);
    expect(p).toMatch(/better answer than eighteen half-sourced ones/);
  });

  it("searches each brand's own market, not a generic one", () => {
    expect(scan(KONVERZ)).toContain("global capability centres");
    expect(scan(KONVERZ)).toContain("Philippines");
    expect(scan(KOGNOZ)).toContain("family-led groups");
    expect(scan(KOGNOZ)).not.toContain("global capability centres");
  });

  it("offers only the brand's own lanes", () => {
    const p = scan(KONVERZ);
    for (const lane of Object.keys(KONVERZ.lanes)) expect(p).toContain(lane);
    expect(p).not.toContain("family");
  });

  it("does not ask again for problems already on the list", () => {
    const p = wholePrompt(buildMarketScanPrompt(KONVERZ, { existing: ["Campus offers lapse after eleven days"] }));
    expect(p).toContain("Campus offers lapse after eleven days");
    expect(p).toMatch(/Do not return these again/);
  });
});

describe("planning against the scan", () => {
  const problems = ["Panels re-interview the same candidate", "Campus offers lapse after eleven days"];
  const plan = (marketProblems: string) =>
    wholePrompt(
      buildCalendarPlanPrompt({
        brand: KONVERZ,
        year: 2026,
        monthName: "October",
        availableDays: [1, 2, 5],
        existingTopics: [],
        targetCount: 6,
        marketProblems
      })
    );

  it("carries the problems and asks which one each topic came from", () => {
    const p = plan(formatProblemsBlock(coerceProblems([problem()])));
    expect(p).toContain("Panels re-interview");
    expect(p).toContain('"fromProblem"');
  });

  // Never blocked. Somebody with a month to fill and no appetite for a search
  // still gets a month; they are told what they traded for it elsewhere.
  it("plans without a scan exactly as it did before", () => {
    const p = plan("");
    expect(p).not.toContain("fromProblem");
    expect(p).toMatch(/Plan October 2026/);
  });

  it("resolves the reported number back to the problem's own words", () => {
    const out = coercePlan(
      { items: [{ day: 1, channel: "Konverz page", format: "Carousel", pillar: "How It Works", topic: "A topic about the panel problem", fromProblem: 1 }] },
      { year: 2026, month: 9, occupied: new Set(), brand: KONVERZ, problems }
    );
    expect(out.entries[0].fromProblem).toBe(problems[0]);
  });

  it("drops an out-of-range or missing number rather than attaching the wrong problem", () => {
    const items = [9, 0, -1, "x", null, undefined].map((fromProblem, i) => ({
      day: i + 1,
      channel: "Konverz page",
      format: "Carousel",
      pillar: "How It Works",
      topic: `Topic number ${i + 1} about something real`,
      fromProblem
    }));
    const out = coercePlan({ items }, { year: 2026, month: 9, occupied: new Set(), brand: KONVERZ, problems });
    expect(out.entries.every((e) => e.fromProblem === undefined)).toBe(true);
  });
});
