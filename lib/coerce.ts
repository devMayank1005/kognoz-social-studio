// Deterministic post-processing — the quality firewall (PRD §7).
// Ported verbatim from kognoz-social-studio-v3.jsx (lines ~1201-1266). The
// model has no vote here; every generation/revision runs through this.
// These are pure functions — safe to run server-side (in the /api/claude
// caller) or client-side identically, unlike the original which only ran
// in the browser.

// URLs are design elements, never copy. Strip them from every content field.
// Both brand domains are stripped regardless of which brand is loaded: a Kognoz
// deck can reference the product and a Konverz deck names its parent, so keying
// this to the active brand would let one of the two slip through as body copy.
export function stripUrl(t: unknown): string {
  const before = String(t || "");
  const stripped = before
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/(www\.)?kognozconsulting\.com/gi, "")
    .replace(/(www\.)?konverz\.ai/gi, "")
    .replace(/\s{2,}/g, " ");

  // The two cleanups below exist to tidy what a removed URL left behind:
  // "Read more at kognozconsulting.com" -> "Read more at" -> "Read more". They
  // only run when something was actually removed.
  //
  // They used to run unconditionally, which also took the full stop off any text
  // that simply ended in one. That is invisible on a headline and wrong on a
  // Customer Quote, where the cover is somebody's published sentence and the
  // format's whole job is reproducing it as they wrote it.
  if (stripped === before) return before.trim();

  return stripped
    .replace(/\s+(at|on|via|from|visit|to|see)\s*$/i, "")
    .replace(/[\s,;:.\-]+$/g, "")
    .trim();
}

export function clampText(t: unknown, max: number): string {
  const s = String(t || "").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:.\s]+$/, "");
}

export function stripWrapQuotes(t: unknown): string {
  const s = String(t || "").trim();
  return /^["'\u201c\u2018].*["'\u201d\u2019]$/.test(s) ? s.slice(1, -1).trim() : s;
}

// The gradient word is the signature; if the model forgot to mark one, mark
// the longest meaningful word so every cover carries it.
export function ensureEm(t: unknown): string {
  const s = String(t || "");
  if (s.includes("*")) return s;
  const words = s.split(/\s+/);
  let bi = -1,
    bl = 0;
  words.forEach((w, i) => {
    const c = w.replace(/[^A-Za-z]/g, "");
    if (c.length > bl && c.length > 3) {
      bl = c.length;
      bi = i;
    }
  });
  if (bi === -1) return s;
  words[bi] = "*" + words[bi] + "*";
  return words.join(" ");
}

// Structural enforcement: line-break before any inline "Source:" and before a
// Kognoz/Konverz capability sentence, regardless of what the model returned.
export function structureBody(t: unknown): string {
  return String(t || "")
    .replace(/\s*[\u2014\u2013]\s*/g, "\n") // em/en dash clause-chains become separate lines (the dash is banned)
    .replace(/\s+(Source\s*:)/g, "\n$1")
    .replace(/([.!?])\s+((?:Kognoz|Konverz)\b)/g, "$1\n$2")
    .split("\n")
    .map((ln) => {
      const l = ln.trim();
      return l ? l.charAt(0).toUpperCase() + l.slice(1) : l;
    })
    .filter(Boolean)
    .join("\n");
}

// Single-line fields can't hold line breaks; dashes there become commas.
export function scrubInline(t: unknown): string {
  return String(t || "").replace(/\s*[\u2014\u2013]\s*/g, ", ");
}

export interface RawSlide {
  title?: unknown;
  body?: unknown;
}

export interface CoercedSlide {
  title: string;
  body: string;
}

export interface CoercedContent {
  eyebrow: string;
  cover: string;
  slides: CoercedSlide[];
  cta: string;
}

export interface RawParsed {
  slides?: RawSlide[];
  eyebrow?: unknown;
  cover?: unknown;
  cta?: unknown;
}

/**
 * Character budgets applied after the model replies. These are a silent ceiling:
 * asking a prompt for a 400-character body is pointless if this cuts it to 230,
 * which is exactly why Video Kinetic and Story looked empty no matter what the
 * prompt said. Defaults match the historical values so existing callers are
 * unchanged; formats that genuinely need more copy pass their own.
 */
export interface ContentBudget {
  title?: number;
  body?: number;
  cover?: number;
  cta?: number;
  slides?: number;
  /**
   * Whether a cover with no *asterisk* gets one inserted. True everywhere except
   * Customer Quote, where the cover is somebody's published words and marking a
   * word inside them changes what they said. See FORMAT_BUDGET in lib/formats.ts.
   */
  em?: boolean;
}

export const DEFAULT_BUDGET: Required<ContentBudget> = {
  title: 64,
  body: 230,
  cover: 95,
  // Founder Video asks for a ~280-char LinkedIn caption in `cta`; the old 110 was
  // throwing away roughly 60% of it before anyone could read it.
  cta: 300,
  slides: 8,
  em: true
};

export function coerceContent(parsed: RawParsed, keepCount?: number, budget: ContentBudget = {}): CoercedContent {
  const b = { ...DEFAULT_BUDGET, ...budget };
  const raw = Array.isArray(parsed.slides) ? parsed.slides : [];
  const out: CoercedSlide[] = raw
    .map((x) => ({
      title: scrubInline(clampText(stripUrl(x && x.title), b.title)),
      body: structureBody(clampText(stripUrl(x && x.body), b.body))
    }))
    .filter((x) => x.title || x.body);
  if (!out.length) throw new Error("no slides");
  return {
    eyebrow: scrubInline(clampText(stripUrl(parsed.eyebrow), 40)),
    cover: (() => {
      const c = scrubInline(clampText(stripWrapQuotes(stripUrl(parsed.cover)), b.cover));
      return b.em ? ensureEm(c) : c;
    })(),
    slides: out.slice(0, keepCount || b.slides),
    cta: scrubInline(clampText(stripUrl(parsed.cta), b.cta))
  };
}

// plainWords — splits *emphasized* text into {t, em} tokens for rendering
// the gradient word (used by the Slide renderer's kinetic video variant).
export function plainWords(text: unknown): { t: string; em: boolean }[] {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ({ t: w.replace(/\*/g, ""), em: w.includes("*") }));
}

// Matches the closing card whichever brand wrote it. The model is told the
// brand's own phrase, but it has been observed returning the other one, and a
// deck whose last card says "The Kognoz read" under a Konverz logo is worse than
// a mislabelled kicker — it reads as the wrong company answering.
const READ_CLOSER_RE = /(kognoz|konverz)\s+read/i;

// Idea Deck kicker normalization by style (PRD §7 point 7) — ported verbatim
// from generate()'s post-processing after coerceContent.
export function applyIdeaDeckKickers(
  slides: CoercedSlide[],
  ideaStyle: "signals" | "book" | "story",
  /**
   * The brand's closing-card kicker. Defaults to Kognoz so every existing caller
   * and test keeps its behaviour; Konverz passes "The Konverz read".
   */
  readCloser = "The Kognoz read"
): CoercedSlide[] {
  let nSig = 0;
  return slides.map((sl) => {
    if (/^ask\b/i.test(sl.title)) return { ...sl, title: "Ask" };
    if (/^reveal\b/i.test(sl.title)) return { ...sl, title: "Reveal" };
    if (ideaStyle === "book") {
      if (READ_CLOSER_RE.test(sl.title)) return { ...sl, title: readCloser };
      nSig += 1;
      return { ...sl, title: `Idea ${String(nSig).padStart(2, "0")}` };
    }
    if (ideaStyle === "story") return sl; // Scene/Turn/Read/Lesson kickers stand as written
    nSig += 1;
    return { ...sl, title: `Signal ${String(nSig).padStart(2, "0")}` };
  });
}

// Stat Card hygiene (PRD §7 point 6) — ported verbatim. If the title is over
// 12 chars, split at the first period/newline: the figure stays as title,
// the remainder prepends to body; then one-sentence-per-line split; strip
// figure-echo when body opens with "<figure> of ".
export function applyStatCardHygiene(slide: CoercedSlide): CoercedSlide {
  const s0 = { ...slide };
  const t = String(s0.title || "");
  if (t.length > 12) {
    const mm = t.match(/^([^.\n]{1,12}?)(?:[.\n]\s*)(.+)$/);
    if (mm) {
      s0.title = mm[1].trim();
      s0.body = (mm[2].trim() ? mm[2].trim() + "\n" : "") + String(s0.body || "");
    }
  }
  // one sentence per line on stat cards; the figure lives in the numeral, not the prose
  s0.body = structureBody(String(s0.body || "").replace(/([.!?])\s+(?=[A-Z0-9"'(])/g, "$1\n"));
  const ttl = String(s0.title || "").trim();
  if (ttl && s0.body.toLowerCase().startsWith(ttl.toLowerCase() + " of ")) {
    s0.body = s0.body.slice(ttl.length + 4);
    s0.body = s0.body.charAt(0).toUpperCase() + s0.body.slice(1);
  }
  return s0;
}

/**
 * Every per-format hygiene rule, in one call.
 *
 * These used to be four `if (format === ...)` lines at each of two call sites in
 * Studio's generate(), once for the draft and once for the line-edited version.
 * Two copies of a growing list is how the second one ends up missing a rule, and
 * a rule that runs on the draft but not on the edit is invisible: the slide looks
 * right until somebody regenerates.
 */
export function applyFormatHygiene(
  content: CoercedContent,
  opts: { format: string; ideaStyle?: "signals" | "book" | "story"; readCloser?: string }
): CoercedContent {
  const { format, ideaStyle = "signals", readCloser } = opts;
  let slides = content.slides;

  if (format === "Idea Deck") slides = applyIdeaDeckKickers(slides, ideaStyle, readCloser);

  // Stat Card and Numbers Wall are the same problem at different counts: a tile
  // whose title must be the figure alone, and a model that keeps writing the
  // whole sentence into it.
  if (format === "Stat Card" && slides[0]) slides = [applyStatCardHygiene(slides[0]), ...slides.slice(1)];
  if (format === "Numbers Wall") slides = slides.map(applyStatCardHygiene);

  return slides === content.slides ? content : { ...content, slides };
}
