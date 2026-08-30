// Deterministic post-processing — the quality firewall (PRD §7).
// Ported verbatim from kognoz-social-studio-v3.jsx (lines ~1201-1266). The
// model has no vote here; every generation/revision runs through this.
// These are pure functions — safe to run server-side (in the /api/claude
// caller) or client-side identically, unlike the original which only ran
// in the browser.

// URLs are design elements, never copy. Strip them from every content field.
export function stripUrl(t: unknown): string {
  return String(t || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/(www\.)?kognozconsulting\.com/gi, "")
    .replace(/\s{2,}/g, " ")
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
}

export const DEFAULT_BUDGET: Required<ContentBudget> = {
  title: 64,
  body: 230,
  cover: 95,
  // Founder Video asks for a ~280-char LinkedIn caption in `cta`; the old 110 was
  // throwing away roughly 60% of it before anyone could read it.
  cta: 300,
  slides: 8
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
    cover: ensureEm(scrubInline(clampText(stripWrapQuotes(stripUrl(parsed.cover)), b.cover))),
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

// Idea Deck kicker normalization by style (PRD §7 point 7) — ported verbatim
// from generate()'s post-processing after coerceContent.
export function applyIdeaDeckKickers(slides: CoercedSlide[], ideaStyle: "signals" | "book" | "story"): CoercedSlide[] {
  let nSig = 0;
  return slides.map((sl) => {
    if (/^ask\b/i.test(sl.title)) return { ...sl, title: "Ask" };
    if (/^reveal\b/i.test(sl.title)) return { ...sl, title: "Reveal" };
    if (ideaStyle === "book") {
      if (/kognoz read/i.test(sl.title)) return { ...sl, title: "The Kognoz read" };
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
