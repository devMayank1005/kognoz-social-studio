// The second pass: write, then line-edit.
//
// Pass one drafts. Pass two reads that draft back with real human writing beside
// it and a list of what the linter already found wrong, and rewrites the
// sentences. It is a separate call because it is a separate job: the drafting
// call cannot see its own output, has thinking disabled, and must answer in bare
// JSON, so the old "draft first, then audit your draft" instruction in the
// generate prompt had nowhere to happen.
//
// ONE RULE GOVERNS THIS FILE. A failed second pass must never cost the first.
// The draft is already paid for and already usable. Every failure path here
// returns it untouched with `applied: false`, and the caller shows it. Throwing
// would make a quality improvement into a way to lose work.
"use client";

import { callClaudeJSON, callClaudeText } from "./claudeClient";
import { buildHumanizePrompt } from "./promptBuilders";
import { formatFindings, lintContent, lintText, lintTopics, type SlopReport } from "./slopLint";
import { KOGNOZ, type Brand } from "./brands";
import type { VoiceSample } from "./voiceSamples";

/**
 * Options every entry point here shares.
 *
 * `brand` matters twice over. It decides whose voice the editor is told it is
 * editing for, and it decides which banned list the draft is measured against —
 * the SAME list the prompt quotes back, via `bannedFor`. Without that second
 * half, a Konverz draft would be linted for words its own canon is built on
 * ("journey", "elevate") and the edit pass would spend its one turn fixing
 * things that are not broken.
 */
export interface HumanizeOpts {
  brand?: Brand;
  voiceSamples?: VoiceSample[];
  housePrefs?: string;
  channel?: string;
  maxTokens?: number;
}

export interface HumanizeResult<T> {
  /** The rewritten value, or the original draft when the pass could not run. */
  value: T;
  /** How many editing calls actually landed. 0 when the pass could not run. */
  rounds?: number;
  /**
   * What went in, so a caller can show what the pass changed without holding on
   * to the pass-one value itself. Equal to `value` when the pass did not run.
   */
  draft: T;
  before: SlopReport;
  after: SlopReport;
  applied: boolean;
  /** Why it did not run. Shown quietly; the draft is still good. */
  note?: string;
}

const failed = <T,>(value: T, before: SlopReport, note: string): HumanizeResult<T> => ({
  value,
  rounds: 0,
  draft: value,
  before,
  after: before,
  applied: false,
  note
});

/**
 * Below this, the rewrite is still reading as machine-made and is worth another look.
 *
 * 85 is two medium findings, or one high plus one low, against lib/slopLint's
 * weights. Set where it is because the linter is a nudge and not a truth: chasing
 * 100 would spend a second Opus call on a tricolon nobody minds, while anything
 * looser lets a banned phrase and a rhetorical question through together.
 */
export const GOOD_ENOUGH = 85;

/**
 * Editing calls per piece, hard cap.
 *
 * Two, because the second round is where most of the remaining gain is and the
 * third reliably starts trading accuracy for novelty — it has already fixed the
 * real faults and begins rewriting sentences that were fine. It is also the point
 * where cost stops being worth arguing about.
 */
export const MAX_ROUNDS = 2;

/** A high-severity finding is a rule violation, not a matter of taste. Always worth another pass. */
function stillWrong(report: SlopReport): boolean {
  return report.score < GOOD_ENOUGH || report.findings.some((f) => f.severity === "high");
}

/**
 * Run the edit until it is good enough, the rounds run out, or a call fails.
 *
 * `editOnce` returns null for a reply that broke its contract — a deck with the
 * wrong slide count, a summary where a line-edit was asked for. That is a
 * rejection rather than an error, and it stops the loop: a model that just
 * ignored the shape will not respect it better on the next try.
 *
 * TWO INVARIANTS, both load-bearing:
 *
 *   The original draft is never lost. Every exit path returns either an improved
 *   version or the draft exactly as it arrived, which is the rule this whole file
 *   is built on.
 *
 *   The BEST round wins, not the last one. A second pass can score worse than the
 *   first — it is rewriting already-decent prose by then — and keeping the last
 *   result on principle would hand back the worse of two things we paid for.
 */
async function refine<T>(
  draft: T,
  lint: (value: T) => SlopReport,
  editOnce: (current: T, findings: string) => Promise<T | null>
): Promise<{ value: T; after: SlopReport; rounds: number; note?: string }> {
  let best = draft;
  let bestReport = lint(draft);
  let current = draft;
  let currentReport = bestReport;
  let rounds = 0;

  for (let i = 0; i < MAX_ROUNDS; i++) {
    let next: T | null;
    try {
      next = await editOnce(current, formatFindings(currentReport));
    } catch (e) {
      // A later round failing is not a failure of the whole pass: we already hold
      // an edited version. Keep it and stop.
      if (rounds > 0) break;
      throw e;
    }
    if (!next) break;

    rounds += 1;
    current = next;
    currentReport = lint(next);

    // The FIRST successful round always wins over the draft, whatever the score
    // says. The score is a lexical-and-rhythm nudge and cannot see most of what
    // this pass is for — a concrete scene replacing an abstraction, a connective
    // cut so the reader makes the jump. A clean draft rewritten into equally
    // clean prose scores identically and is still the better piece, so comparing
    // scores from round one would throw away every edit to already-clean copy.
    //
    // From round two on, the comparison is real: by then we are choosing between
    // two edited versions, and a later pass rewriting decent prose can genuinely
    // come out worse.
    if (rounds === 1 || currentReport.score > bestReport.score) {
      best = next;
      bestReport = currentReport;
    }
    if (!stillWrong(currentReport)) break;
  }

  return { value: best, after: bestReport, rounds };
}

export interface DeckContent {
  eyebrow?: string;
  cover: string;
  slides: { title: string; body: string }[];
  cta: string;
}

/**
 * Rewrite a generated deck.
 *
 * The slide count and the field roles are fixed by the format contract and by
 * the renderer, so a reply that changes either is rejected outright rather than
 * coerced: a montage with four frames or a stat card whose title stopped being a
 * number is worse than the draft it replaced.
 */
export async function humanizeDeck(draft: DeckContent, opts: HumanizeOpts = {}): Promise<HumanizeResult<DeckContent>> {
  const brand = opts.brand ?? KOGNOZ;
  const lintOpts = { allowed: brand.allowedPhrases };
  const lint = (d: DeckContent) => lintContent(d, lintOpts);
  const before = lint(draft);

  try {
    const { value, after, rounds } = await refine<DeckContent>(draft, lint, async (current, findings) => {
      const prompt = buildHumanizePrompt({
        brand,
        shape: "deck",
        draft: JSON.stringify(current),
        voiceSamples: opts.voiceSamples,
        findings,
        channel: opts.channel,
        housePrefs: opts.housePrefs
      });
      const raw = await callClaudeJSON("humanize", prompt, { maxTokens: opts.maxTokens ?? 4000 });

      // The slide count and the field roles are fixed by the format contract and
      // by the renderer, so a reply that changes either is rejected outright
      // rather than coerced: a montage with four frames, or a stat card whose
      // title stopped being a number, is worse than the draft it replaced.
      if (!raw || !Array.isArray(raw.slides) || raw.slides.length !== current.slides.length) return null;

      return {
        eyebrow: current.eyebrow,
        cover: typeof raw.cover === "string" && raw.cover.trim() ? raw.cover : current.cover,
        slides: current.slides.map((sl, i) => {
          const r = raw.slides[i] || {};
          return {
            title: typeof r.title === "string" && r.title.trim() ? r.title : sl.title,
            body: typeof r.body === "string" && r.body.trim() ? r.body : sl.body
          };
        }),
        cta: typeof raw.cta === "string" && raw.cta.trim() ? raw.cta : current.cta
      };
    });

    if (!rounds) return failed(draft, before, "the edit pass changed the slide count, so the original was kept");
    return { value, rounds, draft, before, after, applied: true };
  } catch (e) {
    return failed(draft, before, e instanceof Error ? e.message : "the edit pass failed");
  }
}

/** Rewrite a caption, a text post, or a full article. */
export async function humanizeText(draft: string, opts: HumanizeOpts = {}): Promise<HumanizeResult<string>> {
  const brand = opts.brand ?? KOGNOZ;
  const lintOpts = { allowed: brand.allowedPhrases };
  const lint = (t: string) => lintText(t, "text", lintOpts);
  const before = lint(draft);

  try {
    const { value, after, rounds } = await refine<string>(draft, lint, async (current, findings) => {
      const prompt = buildHumanizePrompt({
        brand,
        shape: "text",
        draft: current,
        voiceSamples: opts.voiceSamples,
        findings,
        channel: opts.channel,
        housePrefs: opts.housePrefs
      });
      const out = await callClaudeText("humanize", prompt, { maxTokens: opts.maxTokens ?? 4000 });
      const next = out.trim();

      // A reply far shorter than what went in means it summarised instead of
      // editing. Half is generous; a real line-edit moves length by a little.
      if (!next || next.length < current.trim().length * 0.5) return null;
      return next;
    });

    if (!rounds) {
      return failed(draft, before, "the edit pass returned far less text than the draft, so the original was kept");
    }
    return { value, rounds, draft, before, after, applied: true };
  } catch (e) {
    return failed(draft, before, e instanceof Error ? e.message : "the edit pass failed");
  }
}

export interface PlanItemLike {
  day: number;
  channel: string;
  format: string;
  pillar: string;
  topic: string;
}

/**
 * Rewrite the topic lines of a month plan, leaving the schedule alone.
 *
 * Written in one pass, thirty-six topics converge on a single sentence shape and
 * every downstream post inherits it. Only the `topic` string is taken from the
 * reply; day, channel, format and pillar are copied from the draft, so a model
 * that reorders or reschedules cannot move anything.
 */
export async function humanizePlanTopics<T extends PlanItemLike>(
  items: T[],
  opts: HumanizeOpts = {}
): Promise<HumanizeResult<T[]>> {
  const brand = opts.brand ?? KOGNOZ;
  const lintOpts = { allowed: brand.allowedPhrases };
  const lint = (list: T[]) => lintTopics(list.map((i) => i.topic), lintOpts);
  const before = lint(items);
  if (!items.length) return failed(items, before, "nothing to edit");

  try {
    const { value, after, rounds } = await refine<T[]>(items, lint, async (current, findings) => {
      const prompt = buildHumanizePrompt({
        brand,
        shape: "topics",
        draft: JSON.stringify({
          items: current.map(({ day, channel, format, pillar, topic }) => ({ day, channel, format, pillar, topic }))
        }),
        voiceSamples: opts.voiceSamples,
        findings
      });
      const raw = await callClaudeJSON("humanize", prompt, { maxTokens: opts.maxTokens ?? 10000 });

      if (!raw || !Array.isArray(raw.items) || raw.items.length !== current.length) return null;

      // Only the `topic` string is taken. Day, channel, format and pillar are
      // copied from what went in, so a model that reorders or reschedules cannot
      // move anything.
      return current.map((item, i) => {
        const t = raw.items[i]?.topic;
        return typeof t === "string" && t.trim() ? { ...item, topic: t.trim() } : item;
      });
    });

    if (!rounds) return failed(items, before, "the edit pass changed the number of posts, so the original plan was kept");
    return { value, rounds, draft: items, before, after, applied: true };
  } catch (e) {
    return failed(items, before, e instanceof Error ? e.message : "the edit pass failed");
  }
}

/** One line for the UI: what the edit pass did, or why it did not. */
export function humanizeNote(r: HumanizeResult<unknown>): string {
  if (!r.applied) return r.note ? `Edit pass skipped: ${r.note}.` : "Edit pass skipped.";
  // Naming the round count matters: two rounds on a piece that still scores low
  // is the signal that the corpus is thin, not that the editor was lazy.
  const passes = (r.rounds ?? 1) > 1 ? ` over ${r.rounds} passes` : "";
  const delta = r.after.score - r.before.score;
  if (delta > 0) return `Edit pass${passes}: style score ${r.before.score} to ${r.after.score}.`;
  if (delta < 0) return `Edit pass ran${passes}; style score ${r.before.score} to ${r.after.score}.`;
  return `Edit pass ran${passes}; style score held at ${r.after.score}.`;
}
