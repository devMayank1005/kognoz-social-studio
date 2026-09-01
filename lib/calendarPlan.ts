// Turning a model's month plan into calendar items you can trust.
//
// Same discipline as lib/coerce.ts: take `unknown`, snap every value onto something the
// app already understands, drop what cannot be saved, and fail loudly rather than quietly
// producing an empty month. Pure and I/O-free so the rules are testable without a network
// call or a rendered calendar.
//
// Two things the model is NOT allowed to author, because getting them wrong is silent:
//
//   ids           `markDrafted` matches an item by `id` OR by the legacy numeric `n`, and
//                 the seeded plan already occupies n = 1..36. A generated item reusing one
//                 would flip a different row's status. Generated items get an id and no n.
//   timestamps    createdAt / updatedAt / status are the app's to set, not the model's.

import { PILLARS_LIST, ALL_CONTENT_TYPES, type ContentItem } from "@/components/calendar/types";
import { CHANNEL_IDS, type ChannelId } from "./founderProfiles";

/** What the model is asked to produce per entry. Everything else is filled in here. */
export interface PlannedEntry {
  day: number;
  channel: ChannelId;
  format: string;
  pillar: string;
  topic: string;
}

export interface PlanCoerceOptions {
  year: number;
  /** 0-indexed, matching Date and formatDateKey. */
  month: number;
  /** Dates already carrying a post. Entries landing on these are dropped, never merged over. */
  occupied: Set<string>;
  /** Ceiling on how many entries survive, whatever the model returned. */
  max?: number;
}

const MAX_TOPIC = 110;
const DEFAULT_MAX_ENTRIES = 40;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Snap a model string onto a known value.
 *
 * Case- and space-insensitive, because "behavioral signal" and "Behavioral Signal" are the
 * same intent and rejecting the first would throw away a usable entry. An unrecognised
 * value falls back rather than failing: one odd pillar should not cost the whole month.
 */
export function snapTo<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const v = norm(str(value));
  if (!v) return fallback;
  return allowed.find((a) => norm(a) === v) ?? fallback;
}

/** YYYY-MM-DD, the format formatDateKey produces and the only thing the calendar groups by. */
export function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Days that actually exist in this month — so February never gets a 30th. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export interface CoercedPlan {
  entries: Array<PlannedEntry & { date: string }>;
  /** Dropped because the day was already taken. Surfaced so the UI can say so. */
  skippedOccupied: number;
  /** Dropped because the entry was unusable — no topic, impossible day. */
  skippedInvalid: number;
}

/**
 * Validate a month plan.
 *
 * Throws only when NOTHING survives. A partial month is worth keeping — the alternative is
 * discarding 30 good entries because one was malformed.
 */
export function coercePlan(parsed: unknown, opts: PlanCoerceOptions): CoercedPlan {
  const raw = parsed && typeof parsed === "object" ? (parsed as { items?: unknown }).items : null;
  const list = Array.isArray(raw) ? raw : [];
  const lastDay = daysInMonth(opts.year, opts.month);
  const max = opts.max ?? DEFAULT_MAX_ENTRIES;

  const entries: Array<PlannedEntry & { date: string }> = [];
  const takenThisRun = new Set<string>();
  let skippedOccupied = 0;
  let skippedInvalid = 0;

  for (const it of list) {
    const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;

    const topic = str(o.topic).slice(0, MAX_TOPIC);
    const dayRaw = typeof o.day === "number" ? o.day : Number(str(o.day));
    const day = Number.isFinite(dayRaw) ? Math.floor(dayRaw) : NaN;

    // A missing topic or an impossible day is not recoverable: there is nothing sensible
    // to fall back to, unlike a pillar or a format.
    if (!topic || !Number.isFinite(day) || day < 1 || day > lastDay) {
      skippedInvalid++;
      continue;
    }

    const date = toDateKey(opts.year, opts.month, day);

    // Never write onto a day that already has something. This is the promise the whole
    // feature rests on — the calendar has no undo.
    if (opts.occupied.has(date)) {
      skippedOccupied++;
      continue;
    }

    entries.push({
      day,
      date,
      topic,
      channel: snapTo(o.channel ?? o.platform, CHANNEL_IDS, "Kognoz page"),
      format: snapTo(o.format ?? o.contentType, ALL_CONTENT_TYPES, "Text post"),
      pillar: snapTo(o.pillar, PILLARS_LIST, "Behavioral Signal")
    });
    takenThisRun.add(date);
    if (entries.length >= max) break;
  }

  if (!entries.length) throw new Error("no usable calendar entries");

  // Chronological, so the month reads in order and any callbacks the model planned land
  // the right way round.
  entries.sort((a, b) => a.day - b.day);
  return { entries, skippedOccupied, skippedInvalid };
}

/**
 * Finish the entries into saveable items.
 *
 * `now` and `makeId` are injected rather than called, so the result is deterministic under
 * test — the same reason lib/montage.ts takes no clock.
 */
export function toContentItems(
  plan: CoercedPlan,
  makeId: (index: number) => string,
  now: string
): ContentItem[] {
  return plan.entries.map((e, i) => ({
    id: makeId(i),
    title: e.topic,
    topic: e.topic,
    platform: e.channel,
    contentType: e.format,
    date: e.date,
    // Alternating slots, matching how the hand-written plan spaces two-post days.
    time: i % 2 === 0 ? "10:30" : "14:00",
    status: "Planned" as const,
    pillar: e.pillar,
    createdAt: now,
    updatedAt: now
  }));
}

/** The dates already carrying a post, for the month on screen. */
export function occupiedDates(items: { date: string }[], year: number, month: number): Set<string> {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  return new Set(items.filter((i) => (i.date || "").startsWith(prefix)).map((i) => i.date));
}
