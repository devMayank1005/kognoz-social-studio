// Reading a fact-check result.
//
// Pure and I/O-free, so the part that decides what a verdict MEANS is testable without a
// network call. The model's reply is `unknown` until it has been through here.
//
// The distinction this module exists to protect: **unverifiable is not wrong.**
//
// "We could not confirm this" and "this is false" are different claims about the world,
// and collapsing them into one ✗ makes the tool lie in the more damaging direction —
// someone deletes a true sentence because a search engine had a bad day. They are
// counted separately, coloured separately, and summarised separately.

export type Verdict = "verified" | "wrong" | "unverifiable";

export interface Claim {
  /** "cover", "slide 3", "cta" — where in the deck it sits. */
  where: string;
  /** The claim as written, verbatim. */
  claim: string;
  verdict: Verdict;
  /** One sentence on what the search actually showed. */
  note: string;
  /** Publication and year, when there is one. */
  realSource: string | null;
}

const VERDICTS: Verdict[] = ["verified", "wrong", "unverifiable"];

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Coerce the model's reply into claims we can render.
 *
 * Anything unreadable is dropped rather than shown as a mystery row, and an unrecognised
 * verdict becomes `unverifiable` — the conservative direction. Guessing `verified` would
 * wave a bad number through; guessing `wrong` would flag a good one.
 */
export function coerceClaims(raw: unknown): Claim[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: Claim[] = [];

  for (const item of list) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const claim = str(o.claim);
    // A row with no claim text says nothing to the reader and cannot be acted on.
    if (!claim) continue;

    const v = str(o.verdict).toLowerCase();
    out.push({
      where: str(o.where) || "somewhere in this deck",
      claim,
      verdict: (VERDICTS as string[]).includes(v) ? (v as Verdict) : "unverifiable",
      note: str(o.note),
      realSource: str(o.realSource) || null
    });
  }

  return out;
}

export interface ClaimSummary {
  total: number;
  verified: number;
  wrong: number;
  unverifiable: number;
  /** True when something is actually wrong — the only case that demands a change. */
  needsAttention: boolean;
}

export function summarise(claims: Claim[]): ClaimSummary {
  const count = (v: Verdict) => claims.filter((c) => c.verdict === v).length;
  const wrong = count("wrong");
  return {
    total: claims.length,
    verified: count("verified"),
    wrong,
    unverifiable: count("unverifiable"),
    needsAttention: wrong > 0
  };
}

/**
 * Worst first: wrong, then unverifiable, then verified.
 *
 * A list that opens on ten green ticks buries the one red row that needed reading, and
 * the whole point of the pass is that one row.
 */
export function sortClaims(claims: Claim[]): Claim[] {
  const rank: Record<Verdict, number> = { wrong: 0, unverifiable: 1, verified: 2 };
  return [...claims].sort((a, b) => rank[a.verdict] - rank[b.verdict]);
}

/** One line for the header, stating what was found without overclaiming. */
export function summaryLine(s: ClaimSummary): string {
  if (!s.total) return "Nothing to check yet.";
  if (s.wrong > 0) {
    return `${s.wrong} claim${s.wrong === 1 ? "" : "s"} contradicted by the search.`;
  }
  if (s.unverifiable > 0) {
    // Deliberately not "all good": unconfirmed is not the same as confirmed.
    return `Nothing contradicted, but ${s.unverifiable} could not be confirmed either way.`;
  }
  return `All ${s.verified} claim${s.verified === 1 ? "" : "s"} confirmed.`;
}
