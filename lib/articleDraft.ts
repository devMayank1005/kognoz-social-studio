// Keeping the long-form article across a reload.
//
// The article was plain component state: it appeared in no store key and no localStorage
// key, so refreshing the page destroyed a 900–1200 word piece that cost roughly $0.02 to
// generate, with no warning and no undo. Everything else expensive in the app survives —
// the deck, the design, the house style — and the article did not.
//
// It lives in localStorage rather than /api/store on purpose. The store blobs are shared
// team-wide (kognoz-design, kognoz-calendar), so putting a half-written draft there would
// let two people silently overwrite each other. A draft is personal to the browser it was
// written in, which is exactly what localStorage is.
//
// Pure and I/O-free, same rule as lib/costControls.ts: this decides whether a user sees
// their own work again, so it stays unit-testable.

export const ARTICLE_DRAFT_KEY = "kognoz-article-draft";

export interface ArticleDraft {
  /** The topic the article was written for — used to spot a draft that no longer fits. */
  topic: string;
  pillar: string;
  text: string;
  savedAt: string;
}

/** An empty or whitespace-only article is not worth storing, and not worth restoring. */
export function isWorthSaving(text: string): boolean {
  return Boolean(text && text.trim());
}

export function makeDraft(topic: string, pillar: string, text: string, savedAt: string): ArticleDraft {
  return { topic: topic ?? "", pillar: pillar ?? "", text, savedAt };
}

export function serialiseDraft(draft: ArticleDraft): string {
  return JSON.stringify(draft);
}

/**
 * Read a stored draft back.
 *
 * Returns null rather than throwing on anything unusable — absent, malformed JSON, valid
 * JSON of the wrong shape, or an empty article. This runs on mount, so a corrupt value
 * must not be able to take the whole editor down with it.
 */
export function parseDraft(raw: string | null | undefined): ArticleDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const d = parsed as Partial<ArticleDraft>;
  if (typeof d.text !== "string" || !isWorthSaving(d.text)) return null;
  return {
    topic: typeof d.topic === "string" ? d.topic : "",
    pillar: typeof d.pillar === "string" ? d.pillar : "",
    text: d.text,
    savedAt: typeof d.savedAt === "string" ? d.savedAt : ""
  };
}

/** Topics match if they are the same words — spacing and case are not the user's intent. */
export function sameTopic(a: string, b: string): boolean {
  const norm = (s: string) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) === norm(b);
}
