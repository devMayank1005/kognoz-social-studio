// Keeping per-slide side data aligned with the slide array.
//
// Studio holds three maps beside `slides`, and they are keyed differently:
//
//   images  keyed by SLIDE index  ("s0", "s1", …) alongside fixed, non-positional
//           keys such as "cover", "article", "story" and the montage frames "m0"–"m2"
//   scales  keyed by DECK index   (on deck formats the cover is 0, so slide i is i+1)
//   imgOn   keyed by DECK index   (same)
//
// Removing a slide used to splice `slides` and leave all three untouched, so every
// photo, text-size override and photo toggle from the removal point onward silently
// belonged to the wrong slide. These helpers do the shift; they are pure so the
// behaviour can be tested without rendering the editor.

/** Deck index of a slide. Deck formats put the cover at 0; single formats do not. */
export function deckIndexOfSlide(slideIndex: number, isDeck: boolean): number {
  return isDeck ? slideIndex + 1 : slideIndex;
}

/**
 * Drop the removed slide's photo and pull every later "s{n}" key down one.
 * Non-positional keys are passed through untouched.
 */
export function shiftSlideImages<T>(map: Record<string, T>, removedSlideIndex: number): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(map)) {
    const hit = /^s(\d+)$/.exec(k);
    if (!hit) {
      out[k] = v;
      continue;
    }
    const idx = Number(hit[1]);
    if (idx === removedSlideIndex) continue;
    out[idx > removedSlideIndex ? `s${idx - 1}` : k] = v;
  }
  return out;
}

/** Same, for the numerically keyed deck-index maps. */
export function shiftDeckMap<T>(map: Record<number, T>, removedDeckIndex: number): Record<number, T> {
  const out: Record<number, T> = {};
  for (const [k, v] of Object.entries(map)) {
    const idx = Number(k);
    if (idx === removedDeckIndex) continue;
    out[idx > removedDeckIndex ? idx - 1 : idx] = v;
  }
  return out;
}

/** Where the preview should sit after a removal, so it never points past the deck. */
export function currentAfterRemoval(current: number, removedDeckIndex: number): number {
  return current > removedDeckIndex ? current - 1 : current;
}

// ---------------------------------------------------------------------------
// Montage frame geometry.
//
// Montage exports as `frames` separate carousel slides sliced out of one wide canvas.
// The cards were laid out in a single padded flex row and froze at maxWidth 900, which
// put card three at x=2140 against a cut at x=2160: 20px of it bled into frame two and
// was missing from frame three. Frames are exact equal columns; nothing may cross a cut.
// ---------------------------------------------------------------------------

export function frameWidth(baseW: number, frames: number): number {
  return baseW / frames;
}

/** The x range each exported frame covers. */
export function frameBounds(baseW: number, frames: number): Array<{ start: number; end: number }> {
  const w = frameWidth(baseW, frames);
  return Array.from({ length: frames }, (_, i) => ({ start: i * w, end: (i + 1) * w }));
}

/** True when a column sits entirely inside the frame of the same index. */
export function columnsRespectFrames(
  columns: Array<{ start: number; end: number }>,
  baseW: number,
  frames: number
): boolean {
  const bounds = frameBounds(baseW, frames);
  if (columns.length !== frames) return false;
  return columns.every((c, i) => c.start >= bounds[i].start && c.end <= bounds[i].end);
}

/** How many files a download-all produces: one per deck entry, times the frame slices. */
export function exportFileCount(deckLength: number, frames?: number): number {
  return deckLength * (frames || 1);
}
