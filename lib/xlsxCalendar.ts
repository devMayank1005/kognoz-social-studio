// Turning an editorial spreadsheet into calendar items you can trust.
//
// Same discipline as lib/calendarPlan.ts, and for the same reason: take `unknown`,
// snap every value onto something the app already understands, and say out loud what
// could not be read rather than quietly inventing it. Pure and I/O-free — it is handed
// rows somebody else has already read, never a file or a URL. That is what lets the
// Node import script and (phase 2) a browser file picker share one implementation,
// since `read-excel-file` has a different entry point for each.
//
// Three rules here are the whole point of the module:
//
//   blank ≠ unmapped   `snapTo` collapses both into its fallback, silently. A row whose
//                      Pillar cell is empty and a row whose Pillar says something we
//                      have never seen are different problems, and neither should look
//                      like a deliberate choice. `mapOrReport` keeps them apart and
//                      reports both.
//   the sheet is       An import is not a planner. The spreadsheet is the authority on
//   the authority      what has already been posted and what the caption says, which is
//                      exactly the opposite of the contract in lib/calendarPlan.ts
//                      ("status is the app's to set, not the model's"). That is why the
//                      item builder lives here and not there.
//   ids are stable     Re-running the import must not double the calendar, so an item's
//                      id is derived from its sheet and row, never from a clock.

import { toDateKey, daysInMonth } from "./calendarPlan";
import { ALL_CONTENT_TYPES, type ContentItem, type ContentStatus } from "@/components/calendar/types";

/** What `read-excel-file` hands back per cell. */
export type CellValue = string | number | boolean | Date | null;
export type SheetRow = CellValue[];

/**
 * The brand vocabulary a sheet is translated into.
 *
 * A plain descriptor rather than the `Brand` object on purpose: lib/brands.ts carries
 * ~300KB of base64 logos, which has no business in a CLI script — the same reason
 * lib/supabase.ts does not derive STORE_KEYS from it.
 */
export interface BrandSpec {
  id: string;
  channelIds: readonly string[];
  pillars: readonly string[];
  defaultChannel: string;
}

export interface ParseOptions {
  /** The year the sheet's bare day-and-month dates belong to. */
  year: number;
  /** Injected clock, so the same rows always produce the same items. */
  now: string;
  /** Dates already carrying a post. Used to PREFER free days, never to drop a row. */
  occupied?: Set<string>;
  /**
   * Undated rows are never placed on or before this date.
   *
   * An unwritten post dated in the past is a lie about the plan. The script passes
   * today, so a spread lands on days that are still ahead.
   */
  notBefore?: string;
  /** 0-indexed month for undated rows whose sheet states no month at all. */
  fallbackMonth?: number;
}

/** A cell we could not translate. `blank` and `unrecognised` are different failures. */
export interface FieldNote {
  row: number;
  column: string;
  value: string;
  kind: "blank" | "unrecognised";
}

export interface SkippedRow {
  row: number;
  reason: string;
}

export interface MonthReport {
  /** YYYY-MM. */
  month: string;
  dated: number;
  spread: number;
}

export interface ParseResult {
  items: ContentItem[];
  notes: FieldNote[];
  skipped: SkippedRow[];
  months: MonthReport[];
  /**
   * Columns whose value is the same on every row that has one — the Konverz sheet's
   * Drive folder link. Reported once instead of stamped onto eight cards, where it
   * would be noise rather than information.
   */
  constants: Record<string, string[]>;
}

const SOURCE_TAG = "src:nld-timelines-xlsx";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Bare day-and-month, in the only two shapes this kind of sheet uses:
 *
 *   "1st July"   "3rd Aug"   "22nd sept"        day-then-month, with an ordinal
 *   "Fri 10 Jul" "Sun 8 Nov" "Thu 31 Dec"       the same, with a weekday in front
 *
 * Strict on purpose. `new Date("Fri 10 Jul")` succeeds in V8 and silently resolves
 * against the CURRENT year, which is how an import lands a year off without anyone
 * noticing. Anything this does not match is treated as undated, never guessed.
 */
const DATE_RE = /^(?:(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?$/i;

export const text = (v: CellValue): string => (v === null || v === undefined ? "" : String(v).trim());

/**
 * Month name → index, tolerant of how people actually type them.
 *
 * Prefix matching rather than a fixed abbreviation length, because this sheet writes
 * "sept" — four letters, and not the standard three-letter form. Every month is unique
 * at three characters, so a token shorter than that is rejected rather than guessed.
 */
export function monthIndex(token: string): number | null {
  const t = token.toLowerCase().replace(/\./g, "").trim();
  if (t.length < 3) return null;
  const i = MONTHS.findIndex((m) => m.startsWith(t));
  return i === -1 ? null : i;
}

export interface ParsedDate {
  day: number;
  month: number;
  /** The weekday the sheet claimed, when it claimed one. */
  statedWeekday?: string;
}

/** Read one date cell. Returns null for anything that is not a date — "VIDEO", "TBD", "". */
export function parseSheetDate(raw: string): ParsedDate | null {
  const m = DATE_RE.exec(raw.trim());
  if (!m) return null;
  const day = Number(m[2]);
  const month = monthIndex(m[3]);
  if (month === null || !Number.isInteger(day) || day < 1) return null;
  return { day, month, statedWeekday: m[1] ? m[1].toLowerCase() : undefined };
}

/**
 * Check a stated weekday against the year we think the sheet is in.
 *
 * Cheap and decisive: every weekday-prefixed date in a real sheet agrees with exactly
 * one year. If they disagree, the year is wrong and importing would file six months of
 * content one day out, which is the kind of error nobody spots by eye.
 */
export function weekdayMismatch(d: ParsedDate, year: number): string | null {
  if (!d.statedWeekday) return null;
  if (d.day > daysInMonth(year, d.month)) return `day ${d.day} does not exist in ${MONTHS[d.month]} ${year}`;
  const actual = WEEKDAYS[new Date(year, d.month, d.day).getDay()];
  return actual === d.statedWeekday
    ? null
    : `sheet says ${d.statedWeekday} but ${toDateKey(year, d.month, d.day)} is a ${actual}`;
}

export interface Mapped {
  value: string;
  kind: "mapped" | "blank" | "unrecognised";
}

/**
 * Translate one cell through a mapping table.
 *
 * The difference from `snapTo` is the whole reason this exists: snapTo answers with the
 * fallback for an empty cell and for an unknown one alike, so a row the sheet simply did
 * not fill reads afterwards as a deliberate editorial choice. Here the caller gets the
 * fallback AND a note saying which of the two happened.
 */
export function mapOrReport(raw: string, table: Record<string, string>, fallback: string): Mapped {
  const v = raw.trim();
  if (!v) return { value: fallback, kind: "blank" };
  const hit = table[v] ?? table[v.toLowerCase()];
  if (hit) return { value: hit, kind: "mapped" };
  return { value: fallback, kind: "unrecognised" };
}

// ---------------------------------------------------------------------------
// The mapping tables.
//
// Every one of these is a decision somebody made about this specific spreadsheet,
// written down rather than inferred, and every original value also survives on the
// item's `tags` — so a wrong call here is visible and fixable in the UI rather than
// being the only remaining record.
// ---------------------------------------------------------------------------

/** Konverz sheet "Pillar" → the six pillars in KONVERZ_PILLARS_LIST. */
export const KONVERZ_PILLAR_MAP: Record<string, string> = {
  "Case Study": "Customer Story",
  "Product Feature": "Product Update",
  "Founder POV": "Talent Intelligence POV",
  "Insight": "Talent Intelligence POV",
  "Engagement": "Talent Intelligence POV",
  "Informational": "How It Works",
  "Event": "Market Intelligence",
  // Festival greetings have no equivalent among Konverz's six. Market Intelligence
  // keeps them reachable by the brand's own pillar filter, which is what an operator
  // uses daily; "pillar:Festive" on the item says what they really are.
  "Festive": "Market Intelligence"
};

/** Kognoz sheet "Pillar" → the five in PILLARS_LIST. */
export const KOGNOZ_PILLAR_MAP: Record<string, string> = {
  "Organisation Science": "Consulting POV",
  "Culture": "Behavioral Signal",
  "HR Transformation": "From the Work",
  "Family Led Business": "Consulting POV",
  "Work Transformation": "Human + AI"
};

/** Konverz sheet "Format" → ALL_CONTENT_TYPES. */
export const KONVERZ_FORMAT_MAP: Record<string, string> = {
  "Carousel": "Carousel",
  "Video": "Video",
  "Static": "Square"
};

/**
 * Kognoz sheet "Format" → ALL_CONTENT_TYPES.
 *
 * Only "POV carousel" names a format at all; the rest are angles ("Insight",
 * "Governance", "Behavioural science"). Those become Text post, which is what a
 * written-out LinkedIn post with a caption and a CTA actually is.
 */
export const KOGNOZ_FORMAT_MAP: Record<string, string> = {
  "POV carousel": "Carousel",
  "Framework": "Carousel",
  "How to": "Carousel",
  "POV": "Text post",
  "Insight": "Text post",
  "Governance": "Text post",
  "Behavioural science": "Text post"
};

/** Konverz "Status" (col H) and the unlabelled col I, lowercased → ContentStatus. */
export const KONVERZ_STATUS_MAP: Record<string, ContentStatus> = {
  "done": "Posted",
  "static post done": "Posted",
  "posted": "Posted",
  "ethr posted": "Posted"
};

/**
 * Strings that appear in a status column but are notes, not statuses.
 *
 * Kept apart so they are neither read as a status nor reported as unrecognised —
 * they are neither.
 */
const STATUS_NOTES = new Set([
  "confirm date",
  "this will need leadership insights",
  "shoot not yet done"
]);

/**
 * "Harpreet / Vedant" → Harpreet.
 *
 * The amplifier column names one or two people, and only some of them are channels this
 * brand publishes under — "Ayush" and "Kognoz Technologies" are neither. Take the first
 * part that is a real channel, fall back to the brand's default, and keep the original
 * string on the item so the second name is not lost.
 */
export function channelFromAmplifier(raw: string, brand: BrandSpec): Mapped {
  const v = raw.trim();
  if (!v) return { value: brand.defaultChannel, kind: "blank" };
  for (const part of v.split("/").map((p) => p.trim()).filter(Boolean)) {
    const hit = brand.channelIds.find((c) => c.toLowerCase() === part.toLowerCase());
    if (hit) return { value: hit, kind: "mapped" };
  }
  return { value: brand.defaultChannel, kind: "unrecognised" };
}

/** Find the header row by looking for a column we know the sheet must have. */
export function findHeaderRow(rows: SheetRow[], marker: string): number {
  const want = marker.toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i] || []).some((c) => text(c).toLowerCase() === want)) return i;
  }
  return -1;
}

/**
 * Pick days for rows the sheet never dated.
 *
 * Weekdays only, matching CADENCE.weekdaysOnly and what handlePlanMonth does. Free days
 * are preferred but not required: when a month runs out of them the remaining rows stack,
 * because dropping an editorial commitment is worse than two posts on one day — the
 * calendar renders a list per day and already plans two a day.
 *
 * Deterministic by construction: same rows in, same dates out, so a dry run and the write
 * that follows it cannot disagree.
 */
export function spreadDays(
  count: number,
  year: number,
  month: number,
  taken: Set<string>,
  notBefore?: string
): number[] {
  if (count <= 0) return [];
  const last = daysInMonth(year, month);
  const weekdays: number[] = [];
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow === 0 || dow === 6) continue;
    if (notBefore && toDateKey(year, month, d) <= notBefore) continue;
    weekdays.push(d);
  }
  // Nothing usable at all (a month entirely in the past): fall back to every weekday,
  // so the rows still land somewhere rather than vanishing.
  const pool = weekdays.length
    ? weekdays
    : Array.from({ length: last }, (_, i) => i + 1).filter((d) => {
        const dow = new Date(year, month, d).getDay();
        return dow !== 0 && dow !== 6;
      });
  if (!pool.length) return Array.from({ length: count }, () => 1);

  const free = pool.filter((d) => !taken.has(toDateKey(year, month, d)));
  const source = free.length >= count ? free : pool;
  // Even spacing across the month rather than a clump at the start.
  const step = source.length / count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(source[Math.min(source.length - 1, Math.floor(i * step))]);
  return out;
}

interface DraftItem {
  row: number;
  title: string;
  topic: string;
  content?: string;
  platform: string;
  contentType: string;
  pillar: string;
  status: ContentStatus;
  tags: string[];
  /** Set when the sheet stated a date; otherwise the month to spread within. */
  date?: string;
  spreadMonth?: number;
}

/**
 * Finish drafts into ContentItems.
 *
 * `n` is deliberately never set: markDrafted matches an item by id OR by the legacy
 * numeric `n`, and the seeded plan already occupies n = 1..36, so an imported item
 * carrying one would flip a different row's status.
 */
function finish(drafts: DraftItem[], brandId: string, now: string): ContentItem[] {
  const perDate = new Map<string, number>();
  return drafts.map((d) => {
    const date = d.date as string;
    const nth = perDate.get(date) ?? 0;
    perDate.set(date, nth + 1);
    return {
      id: `imp_${brandId}_r${d.row}`,
      title: d.title,
      topic: d.topic,
      content: d.content,
      platform: d.platform,
      contentType: d.contentType,
      date,
      // Slots by position within the day, not within the import: a six-month import
      // alternating by array index would be meaningless.
      time: nth === 0 ? "10:30" : nth === 1 ? "14:00" : "16:00",
      status: d.status,
      pillar: d.pillar,
      tags: d.tags,
      createdAt: now,
      updatedAt: now
    };
  });
}

/** Place drafts: dated ones keep their date, undated ones are spread per month. */
function place(drafts: DraftItem[], opts: ParseOptions): MonthReport[] {
  const taken = new Set(opts.occupied ?? []);
  const reports = new Map<string, MonthReport>();
  const report = (key: string) => {
    let r = reports.get(key);
    if (!r) { r = { month: key, dated: 0, spread: 0 }; reports.set(key, r); }
    return r;
  };

  // Dated rows first, so a spread never claims a day the sheet already asked for.
  for (const d of drafts) {
    if (!d.date) continue;
    taken.add(d.date);
    report(d.date.slice(0, 7)).dated++;
  }

  const byMonth = new Map<number, DraftItem[]>();
  for (const d of drafts) {
    if (d.date || d.spreadMonth === undefined) continue;
    const list = byMonth.get(d.spreadMonth) ?? [];
    list.push(d);
    byMonth.set(d.spreadMonth, list);
  }

  for (const [month, list] of byMonth) {
    const days = spreadDays(list.length, opts.year, month, taken, opts.notBefore);
    list.forEach((d, i) => {
      d.date = toDateKey(opts.year, month, days[i]);
      taken.add(d.date);
      report(d.date.slice(0, 7)).spread++;
    });
  }

  return [...reports.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * The Konverz AI sheet: a six-month LinkedIn calendar.
 *
 * Header on its own row, a sparse Month column that only names a month on its first row,
 * free-text dates, and an unlabelled ninth column that carries both a Drive link and
 * status the labelled Status column does not.
 */
export function parseKonverzSheet(rows: SheetRow[], brand: BrandSpec, opts: ParseOptions): ParseResult {
  const notes: FieldNote[] = [];
  const skipped: SkippedRow[] = [];
  const links: string[] = [];
  const header = findHeaderRow(rows, "Topic / Theme");
  if (header === -1) throw new Error('Konverz sheet: no header row (expected a "Topic / Theme" column)');

  const drafts: DraftItem[] = [];
  let month: number | null = null;

  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const rowNo = i + 1; // 1-based, as the spreadsheet shows it
    const monthCell = text(r[0]);
    if (monthCell) {
      const mi = monthIndex(monthCell);
      if (mi !== null) month = mi;
    }

    const topic = text(r[2]);
    const dateCell = text(r[1]);
    if (!topic) {
      if (dateCell || r.some((c) => text(c))) {
        skipped.push({ row: rowNo, reason: `no topic (Date column says ${JSON.stringify(dateCell)})` });
      }
      continue;
    }

    const parsed = parseSheetDate(dateCell);
    if (parsed) {
      const bad = weekdayMismatch(parsed, opts.year);
      if (bad) throw new Error(`Konverz sheet row ${rowNo}: ${bad}. The year is wrong — refusing to import.`);
    }

    const pillar = mapOrReport(text(r[3]), KONVERZ_PILLAR_MAP, brand.pillars[0]);
    const format = mapOrReport(text(r[6]), KONVERZ_FORMAT_MAP, "Text post");
    if (pillar.kind !== "mapped") notes.push({ row: rowNo, column: "Pillar", value: text(r[3]), kind: pillar.kind });
    if (format.kind !== "mapped") notes.push({ row: rowNo, column: "Format", value: text(r[6]), kind: format.kind });

    const tags = [SOURCE_TAG];
    const push = (k: string, v: string) => { if (v) tags.push(`${k}:${v}`); };
    push("pillar", text(r[3]));
    push("module", text(r[4]));
    push("activity", text(r[5]));
    push("format", text(r[6]));

    // Status is a function of BOTH status columns: col I says "POSTED" on rows whose
    // col H only says "done", and carries "SHOOT NOT YET DONE" where col H is empty.
    let status: ContentStatus = "Planned";
    for (const cell of [text(r[7]), text(r[8])]) {
      if (!cell) continue;
      if (/^https?:\/\//i.test(cell)) { links.push(cell); continue; }
      const low = cell.toLowerCase();
      if (KONVERZ_STATUS_MAP[low]) status = KONVERZ_STATUS_MAP[low];
      else { push("note", cell); if (!STATUS_NOTES.has(low)) notes.push({ row: rowNo, column: "Status", value: cell, kind: "unrecognised" }); }
    }

    drafts.push({
      row: rowNo,
      title: topic,
      topic,
      platform: brand.defaultChannel,
      contentType: format.value,
      pillar: pillar.value,
      status,
      tags,
      date: parsed ? toDateKey(opts.year, parsed.month, parsed.day) : undefined,
      spreadMonth: parsed ? undefined : (month ?? opts.fallbackMonth)
    });
  }

  const months = place(drafts, opts);
  const constants: Record<string, string[]> = {};
  if (links.length) constants["Konverz col I link"] = [...new Set(links)];
  return { items: finish(drafts, brand.id, opts.now), notes, skipped, months, constants };
}

/**
 * The Kognoz sheet: ten written-out posts with full captions.
 *
 * Its "Status" column is empty on every row, so status comes from the slot column —
 * "Posted", "TBD", or a date.
 */
export function parseKognozSheet(rows: SheetRow[], brand: BrandSpec, opts: ParseOptions): ParseResult {
  const notes: FieldNote[] = [];
  const skipped: SkippedRow[] = [];
  const header = findHeaderRow(rows, "Hook (line 1)");
  if (header === -1) throw new Error('Kognoz sheet: no header row (expected a "Hook (line 1)" column)');

  const drafts: DraftItem[] = [];
  const datedMonths: number[] = [];

  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const rowNo = i + 1;
    const hook = text(r[5]);
    if (!hook) {
      if (r.some((c) => text(c))) skipped.push({ row: rowNo, reason: "no hook" });
      continue;
    }

    const slot = text(r[1]);
    const parsed = parseSheetDate(slot);
    if (parsed) {
      const bad = weekdayMismatch(parsed, opts.year);
      if (bad) throw new Error(`Kognoz sheet row ${rowNo}: ${bad}. The year is wrong — refusing to import.`);
      datedMonths.push(parsed.month);
    }

    const pillar = mapOrReport(text(r[2]), KOGNOZ_PILLAR_MAP, brand.pillars[0]);
    const format = mapOrReport(text(r[4]), KOGNOZ_FORMAT_MAP, "Text post");
    const channel = channelFromAmplifier(text(r[9]), brand);
    if (pillar.kind !== "mapped") notes.push({ row: rowNo, column: "Pillar", value: text(r[2]), kind: pillar.kind });
    if (format.kind !== "mapped") notes.push({ row: rowNo, column: "Format", value: text(r[4]), kind: format.kind });
    if (channel.kind !== "mapped") notes.push({ row: rowNo, column: "Amplifier", value: text(r[9]), kind: channel.kind });

    const tags = [SOURCE_TAG];
    const push = (k: string, v: string) => { if (v) tags.push(`${k}:${v}`); };
    push("pillar", text(r[2]));
    push("arm", text(r[3]));
    push("format", text(r[4]));
    push("amplifier", text(r[9]));
    push("slot", slot);

    // Caption, CTA and hashtags are three columns of one post. Joined with blank lines,
    // which is how they are pasted into LinkedIn and how ContentEditorModal shows them.
    const body = [text(r[6]), text(r[7]), text(r[8])].filter(Boolean).join("\n\n");

    drafts.push({
      row: rowNo,
      title: hook,
      topic: hook,
      content: body || undefined,
      platform: channel.value,
      contentType: format.value,
      pillar: pillar.value,
      status: /^posted$/i.test(slot) ? "Posted" : "Planned",
      tags,
      date: parsed ? toDateKey(opts.year, parsed.month, parsed.day) : undefined,
      // An undated row that says "Posted" belongs with the batch it went out in, not in a
      // future month; everything else ("TBD") is unwritten and goes where the caller says.
      spreadMonth: parsed
        ? undefined
        : /^posted$/i.test(slot)
          ? (datedMonths[0] ?? opts.fallbackMonth)
          : opts.fallbackMonth
    });
  }

  // "Posted" rows are resolved after the loop, when the sheet's dated month is known.
  const settled = datedMonths.length ? Math.min(...datedMonths) : opts.fallbackMonth;
  for (const d of drafts) {
    if (!d.date && d.spreadMonth === undefined) d.spreadMonth = settled;
    if (!d.date && d.status === "Posted") d.spreadMonth = settled;
  }

  const months = place(drafts, opts);
  return { items: finish(drafts, brand.id, opts.now), notes, skipped, months, constants: {} };
}

/** Guard: every mapping target must be a value the app actually offers. */
export function mappingTargets(): { pillars: string[]; formats: string[] } {
  return {
    pillars: [...new Set([...Object.values(KONVERZ_PILLAR_MAP), ...Object.values(KOGNOZ_PILLAR_MAP)])],
    formats: [...new Set([...Object.values(KONVERZ_FORMAT_MAP), ...Object.values(KOGNOZ_FORMAT_MAP)])]
  };
}

/** Re-exported so callers validating a format do not need a second import. */
export { ALL_CONTENT_TYPES };
