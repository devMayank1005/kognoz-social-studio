// The colours you just used, remembered across a reload.
//
// IN localStorage, DELIBERATELY, AND NOT IN THE DECK. A recent-colours list is a personal
// convenience, not part of the work: it changes on every click, it means nothing to anyone
// else opening the same deck, and putting it in the deck would turn picking a colour into a
// deck mutation — an autosave, a payload, an undo entry — several times a second while
// somebody drags a slider. The saved palette is the opposite and does live in the deck
// (StoredDeck.palette in lib/deckStore.ts).
//
// It is ONE list across both brands on purpose. These are the colours this person has been
// using, not the colours this brand allows; the brand's own palette is offered separately
// and never needs remembering.
//
// Pure list logic here, same rule as lib/articleDraft.ts, with the two localStorage calls
// kept to the bottom and wrapped — a private window, blocked site data or a full quota all
// throw on access, and none of them is a reason for a colour picker to fail to open.

export const RECENT_COLORS_KEY = "kognoz-recent-colors";

/** Twelve fits two rows of six in the picker, which is as far back as anyone reaches. */
export const MAX_RECENT = 12;

/**
 * Put a colour at the front, most recent first.
 *
 * Case-insensitive de-duplication, because `#AABBCC` and `#aabbcc` are one colour and two
 * swatches of it is a bug people notice immediately. The colour is stored as it was given,
 * though — the comparison is normalised, the value is not.
 * (A brand hex is not used even as an example: lib/designTokens.test.ts lints comments too.)
 */
export function addRecent(list: readonly string[], colour: string): string[] {
  const value = typeof colour === "string" ? colour.trim() : "";
  if (!value) return [...list];
  const key = value.toLowerCase();
  return [value, ...list.filter((c) => c.toLowerCase() !== key)].slice(0, MAX_RECENT);
}

/**
 * Read a stored list back.
 *
 * Returns [] for anything unusable — absent, malformed JSON, valid JSON of the wrong shape,
 * or an array with junk in it. This runs when the picker opens, so a corrupt value must not
 * be able to stop somebody choosing a colour.
 */
export function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is string => typeof c === "string" && c.trim() !== "").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function serialiseRecent(list: readonly string[]): string {
  return JSON.stringify(list.slice(0, MAX_RECENT));
}

/** Read the list, or [] if this browser will not let us. */
export function loadRecent(): string[] {
  try {
    return parseRecent(window.localStorage.getItem(RECENT_COLORS_KEY));
  } catch {
    return [];
  }
}

/** Save the list, or do nothing if this browser will not let us. */
export function saveRecent(list: readonly string[]): void {
  try {
    window.localStorage.setItem(RECENT_COLORS_KEY, serialiseRecent(list));
  } catch {
    // A private window, blocked site data, or a full quota. Forgetting a recent colour is
    // not worth an exception in a click handler.
  }
}
