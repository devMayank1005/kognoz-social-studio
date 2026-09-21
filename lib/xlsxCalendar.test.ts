import { describe, it, expect } from "vitest";
import {
  monthIndex,
  parseSheetDate,
  weekdayMismatch,
  mapOrReport,
  channelFromAmplifier,
  findHeaderRow,
  spreadDays,
  parseKonverzSheet,
  parseKognozSheet,
  mappingTargets,
  KONVERZ_PILLAR_MAP,
  KOGNOZ_PILLAR_MAP,
  type BrandSpec,
  type SheetRow
} from "./xlsxCalendar";
import { KONVERZ_PILLARS_LIST, PILLARS_LIST, ALL_CONTENT_TYPES } from "@/components/calendar/types";
import { KONVERZ_CHANNEL_IDS, CHANNEL_IDS } from "./founderProfiles";

const NOW = "2026-09-21T09:00:00.000Z";

const KONVERZ: BrandSpec = {
  id: "konverz",
  channelIds: KONVERZ_CHANNEL_IDS,
  pillars: [...KONVERZ_PILLARS_LIST],
  defaultChannel: "Konverz page"
};
const KOGNOZ: BrandSpec = {
  id: "kognoz",
  channelIds: CHANNEL_IDS,
  pillars: [...PILLARS_LIST],
  defaultChannel: "Kognoz page"
};

describe("monthIndex", () => {
  it("reads the abbreviations this sheet actually uses, including four-letter sept", () => {
    expect(monthIndex("July")).toBe(6);
    expect(monthIndex("Jul")).toBe(6);
    expect(monthIndex("sept")).toBe(8);
    expect(monthIndex("Sep")).toBe(8);
    expect(monthIndex("dec")).toBe(11);
  });

  it("refuses a token too short to be unambiguous rather than guessing", () => {
    // "ju" is June and July. Guessing here is how a post moves a month.
    expect(monthIndex("ju")).toBeNull();
    expect(monthIndex("")).toBeNull();
  });
});

describe("parseSheetDate", () => {
  it("reads the two shapes the sheet uses", () => {
    expect(parseSheetDate("1st July")).toEqual({ day: 1, month: 6, statedWeekday: undefined });
    expect(parseSheetDate("22nd sept")).toEqual({ day: 22, month: 8, statedWeekday: undefined });
    expect(parseSheetDate("Fri 10 Jul")).toEqual({ day: 10, month: 6, statedWeekday: "fri" });
    expect(parseSheetDate("Sun 8 Nov")).toEqual({ day: 8, month: 10, statedWeekday: "sun" });
  });

  it("tolerates the trailing spaces the Kognoz sheet has", () => {
    expect(parseSheetDate("21st Aug ")).toEqual({ day: 21, month: 7, statedWeekday: undefined });
  });

  it("returns null for the non-dates, rather than letting Date guess a year", () => {
    // new Date("Fri 10 Jul") parses in V8 against the CURRENT year. That is the bug
    // this function exists to prevent, so anything unrecognised must be null.
    for (const junk of ["VIDEO", "TBD", "Posted", "", "   ", "sometime in Q4"]) {
      expect(parseSheetDate(junk)).toBeNull();
    }
  });
});

describe("weekdayMismatch", () => {
  it("passes when the sheet's weekday agrees with the year", () => {
    // Every weekday-prefixed date in this workbook agrees with 2026 and no other year.
    expect(weekdayMismatch({ day: 10, month: 6, statedWeekday: "fri" }, 2026)).toBeNull();
    expect(weekdayMismatch({ day: 8, month: 10, statedWeekday: "sun" }, 2026)).toBeNull();
    expect(weekdayMismatch({ day: 25, month: 11, statedWeekday: "fri" }, 2026)).toBeNull();
  });

  it("catches a wrong year, which is otherwise invisible", () => {
    expect(weekdayMismatch({ day: 10, month: 6, statedWeekday: "fri" }, 2025)).toMatch(/sheet says fri/);
  });

  it("says nothing when the sheet stated no weekday", () => {
    expect(weekdayMismatch({ day: 10, month: 6 }, 2025)).toBeNull();
  });

  it("catches a day that does not exist in the month", () => {
    expect(weekdayMismatch({ day: 31, month: 1, statedWeekday: "mon" }, 2026)).toMatch(/does not exist/);
  });
});

describe("mapOrReport", () => {
  const table = { Insight: "Talent Intelligence POV" };

  it("keeps blank and unrecognised apart, which snapTo cannot", () => {
    expect(mapOrReport("Insight", table, "Outcome Proof")).toEqual({ value: "Talent Intelligence POV", kind: "mapped" });
    expect(mapOrReport("", table, "Outcome Proof")).toEqual({ value: "Outcome Proof", kind: "blank" });
    expect(mapOrReport("Whatever", table, "Outcome Proof")).toEqual({ value: "Outcome Proof", kind: "unrecognised" });
  });
});

describe("channelFromAmplifier", () => {
  it("takes the first named person who is actually a channel", () => {
    expect(channelFromAmplifier("Lokesh", KOGNOZ).value).toBe("Lokesh");
    expect(channelFromAmplifier("Harpreet / Vedant", KOGNOZ).value).toBe("Harpreet");
    expect(channelFromAmplifier("Lokesh / Vedant", KOGNOZ).value).toBe("Lokesh");
    expect(channelFromAmplifier("Lokesh / Harpreet", KOGNOZ).value).toBe("Lokesh");
  });

  it("reports, rather than silently defaulting, when nobody named is a channel", () => {
    const r = channelFromAmplifier("Ayush / Kognoz Technologies", KOGNOZ);
    expect(r).toEqual({ value: "Kognoz page", kind: "unrecognised" });
  });
});

describe("findHeaderRow", () => {
  it("finds the header wherever it sits, so both sheets share one code path", () => {
    const rows: SheetRow[] = [["Title", null], [null, null], ["Month", "Date", "Topic / Theme"]];
    expect(findHeaderRow(rows, "Topic / Theme")).toBe(2);
    expect(findHeaderRow(rows, "Hook (line 1)")).toBe(-1);
  });
});

describe("spreadDays", () => {
  it("only ever picks weekdays", () => {
    const days = spreadDays(8, 2026, 9, new Set()); // October 2026
    for (const d of days) {
      const dow = new Date(2026, 9, d).getDay();
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
    }
  });

  it("prefers days nothing else has claimed", () => {
    const taken = new Set(["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06"]);
    const days = spreadDays(4, 2026, 9, taken);
    for (const d of days) expect(taken.has(`2026-10-${String(d).padStart(2, "0")}`)).toBe(false);
  });

  it("never places an unwritten post in the past", () => {
    const days = spreadDays(4, 2026, 8, new Set(), "2026-09-21"); // September 2026
    for (const d of days) expect(d).toBeGreaterThan(21);
  });

  it("is deterministic, so a dry run and the write that follows cannot disagree", () => {
    const a = spreadDays(8, 2026, 10, new Set(["2026-11-08"]));
    const b = spreadDays(8, 2026, 10, new Set(["2026-11-08"]));
    expect(a).toEqual(b);
  });

  it("spreads rather than clumping at the start of the month", () => {
    const days = spreadDays(4, 2026, 9, new Set());
    expect(Math.max(...days) - Math.min(...days)).toBeGreaterThan(10);
  });
});

// Fixtures mirror the real sheets exactly in shape — header offset, sparse Month
// column, free-text dates, and the unlabelled ninth column.
const konverzRows: SheetRow[] = [
  ["Konverz AI: LinkedIn Content Calendar - July to December 2026", null, null, null, null, null, null, null, null],
  ["Modules: Hire . Nurture . Coach . Learn . Skillmaps . Platform.", null, null, null, null, null, null, null, null],
  ["Month", "Date", "Topic / Theme", "Pillar", "Module", "HR Activity", "Format", "Status", null],
  ["July", "1st July", "Mid-year reviews describe the past", "Insight", "Nurture", "Mid-year reviews", "Static", "done", "https://drive.google.com/drive/folders/X"],
  [null, "VIDEO", "Founder clip: why potential is hard to see", "Founder POV", "Nurture", "Mid-year reviews", "Video", "static post done", "SHOOT NOT YET DONE"],
  [null, "Fri 10 Jul", "ETHRWorld Employee Experience Summit", "Event", null, "Industry event", "Static", "done", "POSTED"],
  [null, "31st July", null, null, null, null, null, null, null],
  ["August", "Sat 15 Aug", "Independence Day: celebrating the people", "Festive", null, null, "Static", null, null],
  [null, "24th Aug", "NLD - Amit Das", null, null, null, null, null, null],
  [null, "24th Aug", "The campus topper and the best hire", "Engagement", "Hire", "Campus hiring", "Static", null, null],
  ["October", null, "Capability-first planning for the new FY", "Informational", "Skillmaps", "Budgeting", "Carousel", null, null],
  [null, null, "Map the skill gap before the L&D budget", "Insight", "Skillmaps", "L&D budgeting", "Static", null, null]
];

describe("parseKonverzSheet", () => {
  const r = parseKonverzSheet(konverzRows, KONVERZ, { year: 2026, now: NOW, notBefore: "2026-09-21" });
  const byId = (id: string) => r.items.find((i) => i.id === id)!;

  it("skips the row that has a date and no topic, and says so", () => {
    expect(r.items).toHaveLength(8);
    expect(r.skipped).toEqual([{ row: 7, reason: 'no topic (Date column says "31st July")' }]);
  });

  it("forward-fills the sparse Month column onto undated rows", () => {
    // Rows 11 and 12 carry no date; only row 11 names October.
    expect(byId("imp_konverz_r11").date.slice(0, 7)).toBe("2026-10");
    expect(byId("imp_konverz_r12").date.slice(0, 7)).toBe("2026-10");
  });

  it("keeps a stated date even when it falls on a weekend", () => {
    // Independence Day is a Saturday. Moving a festive post off its festival is a bug.
    expect(byId("imp_konverz_r8").date).toBe("2026-08-15");
  });

  it("lets two posts the sheet put on one day stay on that day", () => {
    const aug24 = r.items.filter((i) => i.date === "2026-08-24");
    expect(aug24).toHaveLength(2);
    expect(aug24.map((i) => i.time)).toEqual(["10:30", "14:00"]);
  });

  it("reports blank pillars and formats instead of inventing them", () => {
    // The NLD guest booking names a date and a guest and nothing else.
    const blanks = r.notes.filter((n) => n.row === 9);
    expect(blanks.map((n) => `${n.column}/${n.kind}`).sort()).toEqual(["Format/blank", "Pillar/blank"]);
  });

  it("reads status from both status columns, because they disagree", () => {
    // Row 6's Status column says only "done"; the unlabelled column says "POSTED".
    expect(byId("imp_konverz_r6").status).toBe("Posted");
    expect(byId("imp_konverz_r5").status).toBe("Posted");
    expect(byId("imp_konverz_r8").status).toBe("Planned");
  });

  it("keeps a note out of the status and on the item instead", () => {
    expect(byId("imp_konverz_r5").tags).toContain("note:SHOOT NOT YET DONE");
  });

  it("keeps every original value on the item, so a mapping is never the only record", () => {
    expect(byId("imp_konverz_r4").pillar).toBe("Talent Intelligence POV");
    expect(byId("imp_konverz_r4").tags).toEqual([
      "src:nld-timelines-xlsx",
      "pillar:Insight",
      "module:Nurture",
      "activity:Mid-year reviews",
      "format:Static"
    ]);
  });

  it("collects the repeated Drive link once instead of stamping every card", () => {
    expect(r.constants["Konverz col I link"]).toEqual(["https://drive.google.com/drive/folders/X"]);
    expect(r.items.some((i) => (i.tags ?? []).some((t) => t.includes("drive.google")))).toBe(false);
  });

  it("never sets the legacy n, which would flip a seeded row's status", () => {
    for (const i of r.items) expect(i.n).toBeUndefined();
  });

  it("refuses the import when a stated weekday proves the year wrong", () => {
    expect(() => parseKonverzSheet(konverzRows, KONVERZ, { year: 2025, now: NOW })).toThrow(/year is wrong/);
  });

  it("produces the same ids and dates every run", () => {
    const again = parseKonverzSheet(konverzRows, KONVERZ, { year: 2026, now: NOW, notBefore: "2026-09-21" });
    expect(again.items.map((i) => [i.id, i.date])).toEqual(r.items.map((i) => [i.id, i.date]));
  });
});

const kognozRows: SheetRow[] = [
  ["Kognoz  - LinkedIn ", null, null, null, null, null, null, null, null, null, null],
  ["Sno.", "Suggested slot", "Pillar", "Arm", "Format", "Hook (line 1)", "Caption (copy paste ready)", "CTA", "Hashtags", "Amplifier", "Status"],
  [1, "Posted", "Organisation Science", "Consulting", "POV carousel", "There is no best way to organise a company.", "Every leader asks the same question.", "Which decision do you revisit?", "#OrgDesign #Leadership", "Lokesh", null],
  [2, "19th Aug", "Culture", "Consulting", "Behavioural science", "Culture is not the values on your wall.", "Every company has a values poster.", "What does your org reward?", "#Culture", "Harpreet / Vedant", null],
  [3, "21st Aug ", "HR Transformation", "Technologies", "Insight", "An HR platform does not transform your HR.", "Two companies buy the same HRMS.", "What slowed your rollout?", "#HRTech", "Ayush / Kognoz Technologies", null],
  [4, "TBD", "Family Led Business", "Consulting", "Governance", "A strong founder and a strong board rarely grow at the same speed.", null, "Soft close.", "#FamilyBusiness", "Lokesh", null]
];

describe("parseKognozSheet", () => {
  const r = parseKognozSheet(kognozRows, KOGNOZ, {
    year: 2026,
    now: NOW,
    notBefore: "2026-09-21",
    fallbackMonth: 8
  });
  const byId = (id: string) => r.items.find((i) => i.id === id)!;

  it("reads status from the slot column, because the Status column is empty throughout", () => {
    expect(byId("imp_kognoz_r3").status).toBe("Posted");
    expect(byId("imp_kognoz_r4").status).toBe("Planned");
  });

  it("files an already-posted row with the batch it went out in, not in a future month", () => {
    expect(byId("imp_kognoz_r3").date.slice(0, 7)).toBe("2026-08");
  });

  it("puts an unwritten TBD post in the month the caller chose, never in the past", () => {
    expect(byId("imp_kognoz_r6").date.slice(0, 7)).toBe("2026-09");
    expect(byId("imp_kognoz_r6").date > "2026-09-21").toBe(true);
  });

  it("joins caption, CTA and hashtags the way the post is pasted into LinkedIn", () => {
    expect(byId("imp_kognoz_r3").content).toBe(
      "Every leader asks the same question.\n\nWhich decision do you revisit?\n\n#OrgDesign #Leadership"
    );
  });

  it("keeps a row whose caption is empty", () => {
    expect(byId("imp_kognoz_r6").content).toBe("Soft close.\n\n#FamilyBusiness");
  });

  it("uses the hook as the title and the angle column as a format", () => {
    expect(byId("imp_kognoz_r4").title).toBe("Culture is not the values on your wall.");
    expect(byId("imp_kognoz_r4").contentType).toBe("Text post");
    expect(byId("imp_kognoz_r3").contentType).toBe("Carousel");
  });

  it("routes the post to the amplifier's own channel", () => {
    expect(byId("imp_kognoz_r4").platform).toBe("Harpreet");
    expect(byId("imp_kognoz_r5").platform).toBe("Kognoz page");
  });
});

describe("mapping tables", () => {
  // Three hand-maintained lists that must not drift apart, guarded the way
  // lib/storeKeys.test.ts guards the store keys.
  it("only ever map onto pillars the app actually offers", () => {
    for (const p of Object.values(KONVERZ_PILLAR_MAP)) expect(KONVERZ_PILLARS_LIST).toContain(p as never);
    for (const p of Object.values(KOGNOZ_PILLAR_MAP)) expect(PILLARS_LIST).toContain(p as never);
  });

  it("only ever map onto content types the Studio can render", () => {
    for (const f of mappingTargets().formats) expect(ALL_CONTENT_TYPES).toContain(f as never);
  });
});
