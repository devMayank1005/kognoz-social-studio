// The Kinetic Video's motion, as numbers rather than as a CSS string.
//
// WHY THIS EXISTS. The animation was four `animation:` shorthands written inline in
// components/Slide.tsx, with the keyframes in app/globals.css. That is enough to play it on
// screen and nothing else — and it is why the Video format could only ever export a poster
// frame. globals.css says as much where the keyframes live: lib/exportPipeline.ts strips
// `<style>` from the cloned node, so at export time the keyframes are simply absent and
// every element renders at its final state.
//
// Recording the format as a video means asking "what does this look like at t = 1.3s", which
// a CSS shorthand cannot answer. So the timing lives here as data, the renderer formats it
// into the CSS it always emitted, and the recorder resolves it per frame. One source of
// truth, which is the point — a delay that drifted between the two would produce a video
// that does not match the preview, and nothing would fail.

/** The two keyframes the format uses. Defined in app/globals.css. */
export type KvName = "kvRise" | "kvFade";

/** Control points of the CSS timing function, for resolving a frame. */
export type Bezier = readonly [number, number, number, number];

/** CSS `ease`, spelled out — the curve the keyword actually means. */
export const EASE: Bezier = [0.25, 0.1, 0.25, 1];
/** The headline's own curve, a firmer settle than `ease`. */
export const RISE_EASE: Bezier = [0.2, 0.75, 0.2, 1];

/** How far a rising word travels. Matches the `kvRise` keyframe in app/globals.css. */
export const RISE_PX = 30;

export interface KineticStep {
  name: KvName;
  /** Seconds from the start of the sequence. */
  delay: number;
  duration: number;
  /** Written into the CSS shorthand verbatim, so the rendered value does not change. */
  easing: string;
  bezier: Bezier;
}

export interface KineticTimeline {
  eyebrow: KineticStep;
  words: KineticStep[];
  beats: KineticStep[];
  foot: KineticStep;
  /** When the last element has finished moving. */
  duration: number;
}

const fade = (delay: number, duration: number): KineticStep => ({
  name: "kvFade",
  delay: round(delay),
  duration,
  easing: "ease",
  bezier: EASE
});

const rise = (delay: number): KineticStep => ({
  name: "kvRise",
  delay: round(delay),
  duration: 0.8,
  easing: "cubic-bezier(.2,.75,.2,1)",
  bezier: RISE_EASE
});

/** Three decimals. `0.7 + 3 * 0.14` is 1.1199999999999999 in binary floating point. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * The whole sequence, from the word count and the beat count.
 *
 * These constants were the literals in the Video branch of components/Slide.tsx and are
 * unchanged: the eyebrow at 0.25s, a word every 0.14s from 0.7s, the beats starting once the
 * headline has landed, and the footer last.
 */
export function kineticTimeline(wordCount: number, beatCount: number): KineticTimeline {
  const words = Array.from({ length: Math.max(0, wordCount) }, (_, i) => rise(0.7 + i * 0.14));
  const bodyDelay = 0.7 + Math.max(0, wordCount) * 0.14 + 0.4;
  const beats = Array.from({ length: Math.max(0, beatCount) }, (_, i) => fade(bodyDelay + i * 0.5, 0.9));
  const foot = fade(bodyDelay + 1.2, 0.8);
  const eyebrow = fade(0.25, 0.6);

  const ends = [eyebrow, ...words, ...beats, foot].map((s) => s.delay + s.duration);
  return { eyebrow, words, beats, foot, duration: round(Math.max(0, ...ends)) };
}

/**
 * The CSS shorthand, exactly as the slide has always written it.
 *
 * `backwards` and never `forwards`, and no inline opacity: with the keyframes absent at
 * export time the element then renders at full opacity rather than exporting blank. That
 * rule is documented beside the keyframes in app/globals.css and is why the poster PNG works.
 */
export function animationCss(step: KineticStep): string {
  return `${step.name} ${secs(step.duration)} ${step.easing} ${secs(step.delay)} backwards`;
}

/** `0.8` → `.8s`, matching how the values were written by hand. */
function secs(n: number): string {
  const s = String(round(n));
  return `${s.startsWith("0.") ? s.slice(1) : s}s`;
}

/**
 * Solve a cubic Bézier timing function for its y at a given x.
 *
 * Bisection rather than Newton-Raphson: this runs a few hundred times per recorded video,
 * not per frame of a live animation, so the simpler method that cannot fail to converge is
 * the better trade. 24 iterations puts the error below a millionth.
 */
export function bezierAt(b: Bezier, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const [x1, y1, x2, y2] = b;
  const curve = (a: number, c: number, t: number) => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * c + t * t * t;
  };
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 24; i++) {
    const at = curve(x1, x2, t);
    if (at < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return curve(y1, y2, t);
}

/** What one step looks like at time `t`, as the inline style a recorded frame needs. */
export function styleAt(step: KineticStep, t: number): { opacity: number; transform: string } {
  // `backwards` holds the from-state before the delay; after the end the element keeps its
  // own style, which sets neither — so both ends resolve to the settled state.
  const raw = step.duration <= 0 ? 1 : (t - step.delay) / step.duration;
  const p = bezierAt(step.bezier, Math.max(0, Math.min(1, raw)));
  return {
    opacity: round(p),
    transform: step.name === "kvRise" ? `translateY(${round((1 - p) * RISE_PX)}px)` : "none"
  };
}
