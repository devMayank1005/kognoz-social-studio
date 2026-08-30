// Montage is one wide canvas posted as three separate carousel slides, and it should
// read as one continuous piece that happens to be divided — swiping pans across it
// rather than stepping between three unrelated cards.
//
// The headline carries that across the cuts: it is laid out a phrase per frame, so
// swiping reveals the sentence a piece at a time. Which makes where it breaks the whole
// question. Two rules are absolute:
//
//   never mid-word         a word split across a swipe is not a design, it is a bug
//   never inside *…*       the renderer's emphasis markers come in pairs; splitting a
//                          pair leaves one half unclosed and renderEm prints literal
//                          asterisks on the canvas
//
// Pure and testable, because "it looked fine on the one headline I tried" is not
// evidence about a function that runs on every headline the model writes.

/**
 * Words, with each `*emphasised*` span kept whole as a single token.
 *
 * The emphasis alternative is tried first so a multi-word span like `*what they do*`
 * stays intact; an unmatched `*` falls through to the plain-word branch and is treated
 * as an ordinary character, which is what the renderer does with it too.
 */
export function tokenise(text: string): string[] {
  return String(text ?? "").match(/\*[^*]+\*|\S+/g) ?? [];
}

/**
 * Split a headline into `n` phrases of roughly equal length, breaking only between
 * tokens.
 *
 * Always returns exactly `n` strings so callers can index by frame without guarding.
 * With fewer tokens than frames the later frames come back empty rather than throwing —
 * a two-word headline is a real thing the model produces, and it should degrade to a
 * short opener rather than an error.
 */
export function splitAcrossFrames(text: string, n: number): string[] {
  const out: string[] = Array.from({ length: Math.max(0, n) }, () => "");
  if (n < 1) return [];
  const tokens = tokenise(text);
  if (!tokens.length) return out;

  // Target length includes the single space between tokens, so the phrases balance by
  // how wide they will actually set rather than by raw word length.
  const total = tokens.reduce((a, t) => a + t.length, 0) + Math.max(0, tokens.length - 1);
  const target = total / n;

  let i = 0;
  for (let f = 0; f < n && i < tokens.length; f++) {
    const isLast = f === n - 1;
    let cur = "";
    while (i < tokens.length) {
      const remainingFrames = n - f - 1;
      const remainingTokens = tokens.length - i;
      // Stop early rather than starve the frames after this one — but only once this
      // frame has something, otherwise a short headline leaves the FIRST frame blank.
      if (cur && !isLast && remainingTokens <= remainingFrames) break;
      const cost = tokens[i].length + (cur ? 1 : 0);
      if (cur && !isLast && cur.length + cost > target) break;
      cur += (cur ? " " : "") + tokens[i];
      i++;
    }
    out[f] = cur;
  }
  return out;
}

/**
 * Where a frame's phrase sits so the headline spreads across the whole strip.
 *
 * Left-aligning every phrase in its own gutter reset the line hard at each cut and left
 * the right-hand third of the strip empty. Opening at the left margin, closing at the
 * right and centring what is between spreads the same words edge to edge, which is what
 * makes three phrases read as one line — without any word leaving its frame.
 */
export function headlineAlign(frameIndex: number, frames: number): "start" | "center" | "end" {
  if (frameIndex <= 0) return "start";
  if (frameIndex >= frames - 1) return "end";
  return "center";
}

/**
 * The phrase the shared font size must be computed from.
 *
 * One size across all three frames is the difference between one headline and three.
 * It has to be driven by the widest phrase, so that one still fits its frame and the
 * shorter ones match it rather than growing to fill their own space.
 */
export function longestPhrase(phrases: string[]): string {
  return phrases.reduce((longest, p) => ((p || "").length > longest.length ? p : longest), "");
}

/**
 * Which frame carries the eyebrow, the closing line and the mark.
 *
 * The logo appears once, on the last frame, so the strip reads as one piece signed at
 * the end. Repeating it on every frame is the single thing that most breaks the
 * illusion of one continuous image when swiping.
 */
export function frameRoles(frameIndex: number, frames: number) {
  return {
    eyebrow: frameIndex === 0,
    cta: frameIndex === frames - 1,
    logo: frameIndex === frames - 1
  };
}
