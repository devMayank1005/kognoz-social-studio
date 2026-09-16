// The market scan — real, current, sourced problems the month is planned against.
//
// WHY THIS EXISTS.
//
// The month planner wrote 36 topics out of the model's memory. Nothing grounded
// them, so they came out as plausible-sounding consulting abstractions: true of
// somebody, somewhere, at some point, and therefore not true of anyone in
// particular. A month built on those reads as content about an industry rather
// than about the reader's Tuesday.
//
// lib/costControls.ts deliberately excludes `calendarPlan` from web search, with
// a good reason: the founder research is already written down in
// lib/founderProfiles.ts, and re-grounding it every run would pay several times
// over to rediscover facts nobody reviews. That reasoning is right about FOUNDER
// facts and wrong about MARKET facts. Founder facts are stable and already known;
// market facts change, and they are the ones worth spending a search on.
//
// So the research is split out, done once, and READ BY A PERSON before 36 posts
// are built on it. Same philosophy as founderProfiles — find it once, correct it
// once, reuse it — with one difference that matters: market problems go stale, so
// a scan carries the date it was taken and says when it is getting old.
//
// WHAT A SCANNED FIGURE DOES NOT LICENSE.
//
// Everything here is an external claim this app found, not something the brand
// stands behind. It reaches the PLANNER as subject matter and the calendar item
// as context. It does NOT license printing that number on a slide: the sourcing
// rules in buildGeneratePrompt and the Verify facts button are unchanged and
// still decide what appears in copy.
//
// Everything below is pure. Storage is the existing `store` blob under
// `<brand>-market-scan`; see lib/storeClient.ts.
import type { BrandId } from "./brands";

export interface MarketProblem {
  id: string;
  /**
   * One sentence naming something a buyer DOES or CANNOT DO. Not a theme, not a
   * trend. "Panels re-interview the same candidate three times because nobody
   * trusts the first scorecard" is a problem; "the evolving talent landscape" is
   * not, and is exactly what an ungrounded planner produces.
   */
  problem: string;
  /** Who feels it, specifically: "TA head, BFSI, high-volume RM hiring". */
  who: string;
  /** The figure or finding that shows it is real, in the source's own terms. */
  evidence: string;
  /** Publication and year, as found. Empty means the scan could not source it. */
  source: string;
  /** One of the brand's own lane ids, so a topic written from it stays in-lane. */
  lane: string;
  /** "scan" when found automatically, an email when a person wrote or edited it. */
  addedBy?: string;
}

export interface MarketScan {
  brandId: BrandId;
  /** ISO timestamp of the scan this list came from. */
  scannedAt: string;
  problems: MarketProblem[];
}

/**
 * How old a scan gets before the UI says so.
 *
 * Six weeks. Long enough that a monthly planning rhythm does not trip it every
 * time, short enough that a quarter-old hiring statistic never quietly becomes
 * this month's editorial line.
 */
export const SCAN_STALE_DAYS = 45;

/** Below this, a "problem" is a fragment or a theme rather than a sentence about someone. */
export const MIN_PROBLEM_CHARS = 30;

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  return `mp_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Validate anything read back out of the blob.
 *
 * Same discipline as coerceSamples in lib/voiceSamples.ts: blob storage is
 * schemaless and this one is edited by hand, so a malformed row is dropped rather
 * than thrown on. One bad paste should not empty the list.
 *
 * `lanes` is the brand's own lane ids. A problem filed under a lane the brand does
 * not have would route a topic into a prompt block that does not exist, so it is
 * pinned to the first lane instead of being dropped — the problem is still real,
 * only its filing was wrong.
 */
export function coerceProblems(raw: unknown, lanes: string[] = []): MarketProblem[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(lanes);
  const out: MarketProblem[] = [];
  const seen = new Set<string>();

  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const problem = str(o.problem);
    if (problem.length < MIN_PROBLEM_CHARS) continue;

    // The same problem found twice in one scan is noise the planner would treat
    // as two subjects and write two posts about.
    const fingerprint = problem.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const lane = str(o.lane);
    out.push({
      id: str(o.id) || makeId(),
      problem,
      who: str(o.who),
      evidence: str(o.evidence),
      source: str(o.source),
      lane: known.size && !known.has(lane) ? lanes[0] : lane,
      addedBy: str(o.addedBy) || undefined
    });
  }
  return out;
}

export function coerceScan(raw: unknown, brandId: BrandId, lanes: string[] = []): MarketScan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const problems = coerceProblems(o.problems, lanes);
  if (!problems.length) return null;
  return {
    brandId,
    scannedAt: str(o.scannedAt) || new Date(0).toISOString(),
    problems
  };
}

export function newProblem(fields: Omit<MarketProblem, "id">): MarketProblem {
  return { ...fields, id: makeId() };
}

/** Whole days since the scan. Returns null when the date is missing or unreadable. */
export function scanAgeDays(scan: MarketScan | null, now = new Date()): number | null {
  if (!scan?.scannedAt) return null;
  const then = new Date(scan.scannedAt).getTime();
  if (!Number.isFinite(then) || then <= 0) return null;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

export function isScanStale(scan: MarketScan | null, now = new Date()): boolean {
  const age = scanAgeDays(scan, now);
  return age === null || age >= SCAN_STALE_DAYS;
}

/**
 * Render the problems for the planning prompt.
 *
 * Numbered, because the planner is asked to name which problem each topic came
 * from and a number is the cheapest handle. Returns "" when there is nothing, so
 * the caller can concatenate unconditionally and the planner falls back to its
 * own judgment rather than being handed an empty list to obey.
 */
export function formatProblemsBlock(problems: MarketProblem[]): string {
  if (!problems.length) return "";
  const lines = problems.map((p, i) => {
    const bits = [`${i + 1}. ${p.problem}`];
    if (p.who) bits.push(`   Felt by: ${p.who}`);
    if (p.evidence) bits.push(`   Evidence: ${p.evidence}`);
    if (p.source) bits.push(`   Source: ${p.source}`);
    if (p.lane) bits.push(`   Lane: ${p.lane}`);
    return bits.join("\n");
  });
  return `
REAL PROBLEMS IN THIS MARKET RIGHT NOW. Found by search and then read and edited by the team, so this list is the ground the month stands on.

${lines.join("\n\n")}

EVERY TOPIC MUST COME FROM ONE OF THESE. Write the number of the problem it came from in "fromProblem". A topic you cannot trace to one of them is one you invented, and inventing is the thing this list exists to stop. Several posts may work the same problem from different angles, in different voices, in different formats — that is a campaign. What must not happen is a topic about a problem nobody listed.

Do not restate a problem as a topic. The problem is what is wrong; the topic is what this brand has to say about it.
`;
}
