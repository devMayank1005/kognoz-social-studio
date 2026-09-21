// Reading the voice corpus, for the people maintaining it.
//
// Pure and I/O-free. lib/voiceSamples.ts owns the corpus itself — storing, merging,
// picking. This is the layer above: what a contributor needs to SEE about it.
//
// The question it exists to answer is "is my contribution doing anything?". `pickSamples`
// selects about eight per generation, so someone can add ten posts and have none of them
// used — and with nothing surfacing that, they conclude the feature is broken, or worse,
// that it is working.

import { pickSamples, DEFAULT_SAMPLE_COUNT, MIN_SAMPLE_CHARS, type VoiceSample, type SampleKind } from "./voiceSamples";
import type { ChannelId } from "./founderProfiles";

export interface ChannelTally {
  channel: string;
  total: number;
  /** How many of them a generation for this channel would actually draw on. */
  picked: number;
}

/**
 * Per-channel counts, and how many of each would be picked.
 *
 * Only channels with at least one sample appear: listing a founder with `0 / 0` reads as
 * a broken row rather than an absence, and the empty state says it better.
 */
export function channelTallies(samples: VoiceSample[], seed = 0): ChannelTally[] {
  const byChannel = new Map<string, VoiceSample[]>();
  for (const s of samples) {
    const list = byChannel.get(s.channel);
    if (list) list.push(s);
    else byChannel.set(s.channel, [s]);
  }

  return [...byChannel.entries()]
    .map(([channel, list]) => ({
      channel,
      total: list.length,
      picked: pickSamples(samples, { channel, seed }).length
    }))
    .sort((a, b) => b.total - a.total || a.channel.localeCompare(b.channel));
}

/**
 * The ids a generation would draw on right now, across every channel present.
 *
 * Used to mark rows in the list, so a contributor can see their sample being used
 * instead of inferring it.
 */
export function pickedIds(samples: VoiceSample[], seed = 0): Set<string> {
  const out = new Set<string>();
  for (const channel of new Set(samples.map((s) => s.channel))) {
    for (const s of pickSamples(samples, { channel, seed })) out.add(s.id);
  }
  return out;
}

export interface Contributor {
  /** The email recorded on the sample, or a placeholder for older ones. */
  who: string;
  count: number;
}

/**
 * Who has contributed, most first.
 *
 * Samples predate the attribution field, and the seeded ones from the editorial plan
 * have no contributor at all — those are counted honestly rather than assigned to
 * whoever happens to be looking.
 */
export function contributors(samples: VoiceSample[]): Contributor[] {
  const counts = new Map<string, number>();
  for (const s of samples) {
    const who = (s.addedBy || "").trim() || "Added before contributors were recorded";
    counts.set(who, (counts.get(who) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([who, count]) => ({ who, count }))
    .sort((a, b) => b.count - a.count || a.who.localeCompare(b.who));
}

/** Filter for the list. An absent value means "all". */
export function filterSamples(
  samples: VoiceSample[],
  opts: { channel?: string; kind?: SampleKind }
): VoiceSample[] {
  return samples.filter(
    (s) => (!opts.channel || s.channel === opts.channel) && (!opts.kind || s.kind === opts.kind)
  );
}

/**
 * Why a pasted block was refused, or null if it is fine.
 *
 * Returns a sentence rather than a boolean: a paste that silently vanishes is the
 * failure mode here, because the person believes it saved and moves on.
 */
export function rejectionReason(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Nothing to add — the box is empty.";
  if (trimmed.length < MIN_SAMPLE_CHARS) {
    const short = MIN_SAMPLE_CHARS - trimmed.length;
    return `Too short by ${short} character${short === 1 ? "" : "s"}. Under ${MIN_SAMPLE_CHARS} a sample shows word choice but no rhythm or paragraphing, so it would not teach the voice anything.`;
  }
  return null;
}

export interface CorpusState {
  kind: "unreachable" | "empty" | "ready";
  message: string;
}

/**
 * What state the screen is in.
 *
 * "Could not be read" and "there is nothing here" must never look alike. The first means
 * the samples may exist and a save could overwrite them; the second is an invitation to
 * add one. `storeGet` reports `stale: true` for the first.
 */
export function corpusState(samples: VoiceSample[], stale: boolean, brandName: string): CorpusState {
  if (stale) {
    return {
      kind: "unreachable",
      message: `Could not read ${brandName}'s voice samples — this may not be all of them, so adding now risks overwriting what is already saved.`
    };
  }
  if (!samples.length) {
    return {
      kind: "empty",
      message: `No voice samples saved for ${brandName} yet. Until there are, every draft is written with no human writing to imitate.`
    };
  }
  return {
    kind: "ready",
    message: `${samples.length} sample${samples.length === 1 ? "" : "s"}. A generation draws on up to ${DEFAULT_SAMPLE_COUNT} of them.`
  };
}

/** The channels a brand can hold samples for, in a stable order. */
export function channelsFor(brandChannels: Record<string, string>): ChannelId[] {
  return Object.keys(brandChannels) as ChannelId[];
}
