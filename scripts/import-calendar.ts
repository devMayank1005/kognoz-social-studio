// Load the NLD editorial spreadsheet into the two brand content calendars.
//
// Run:
//   npm run import-calendar                 <- dry run: says exactly what it would do
//   npm run import-calendar -- --write      <- does it
//
// Dry run is the default because the calendar has no undo. Read the report, then
// re-run with --write. A backup of each calendar is written either way, before
// anything is parsed, so there is always something to restore from.
//
// Flags:
//   --write                 perform the write (otherwise nothing is sent)
//   --file <path>           a different workbook
//   --as <email>            who to record as the editor (store.updated_by)
//   --today <YYYY-MM-DD>    pin "today", so a dry run and the write agree across midnight
//   --replace-imported      drop rows a previous import added, then re-import
//
// This talks to Supabase directly with the service-role key, the way
// scripts/add-user.mjs does. It cannot use /api/store: that route requires a NextAuth
// session and a script has no cookie, so every call would be 401.

import readXlsxFile from "read-excel-file/node";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseKonverzSheet,
  parseKognozSheet,
  type BrandSpec,
  type ParseResult,
  type SheetRow
} from "../lib/xlsxCalendar";
import { KONVERZ_PILLARS_LIST, PILLARS_LIST, type ContentItem } from "../components/calendar/types";
import { KONVERZ_CHANNEL_IDS, CHANNEL_IDS } from "../lib/founderProfiles";

// --- arguments -------------------------------------------------------------
// process.argv[1] is the vite-node CLI, not this file, so only slice(2) is ours.
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string): string | undefined => {
  const i = argv.indexOf(f);
  return i === -1 ? undefined : argv[i + 1];
};

const WRITE = has("--write");
const REPLACE = has("--replace-imported");
const ACTOR = val("--as") ?? "import-calendar script";
const FILE = val("--file") ?? `${os.homedir()}/Downloads/NLD_Timelines_Single_Sheet (1) (1) - Copy.xlsx`;
const TODAY = val("--today") ?? new Date().toISOString().slice(0, 10);
const BACKUP_DIR = path.join(os.homedir(), "kognoz-calendar-backups");

function die(msg: string): never {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

// --- env -------------------------------------------------------------------
// Read .env.local directly rather than relying on the runner: vite-node does not
// load it, and only VITE_-prefixed vars would reach us if it did.
function env(name: string): string {
  if (process.env[name]) return process.env[name] as string;
  try {
    for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
      if (line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 1 || line.slice(0, i).trim() !== name) continue;
      return line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* fall through to the error below */
  }
  return die(`${name} is not set. Run this with the same env as production (see scripts/add-user.mjs).`);
}

// --- brands ----------------------------------------------------------------
interface BrandJob {
  spec: BrandSpec;
  storeKey: string;
  sheet: string;
  parse: (rows: SheetRow[], brand: BrandSpec, opts: any) => ParseResult;
}

const JOBS: BrandJob[] = [
  {
    spec: { id: "konverz", channelIds: KONVERZ_CHANNEL_IDS, pillars: [...KONVERZ_PILLARS_LIST], defaultChannel: "Konverz page" },
    storeKey: "konverz-calendar",
    sheet: "Konverz AI",
    parse: parseKonverzSheet
  },
  {
    spec: { id: "kognoz", channelIds: CHANNEL_IDS, pillars: [...PILLARS_LIST], defaultChannel: "Kognoz page" },
    storeKey: "kognoz-calendar",
    sheet: "Kognoz",
    parse: parseKognozSheet
  }
];

/**
 * The year the sheet's bare dates belong to.
 *
 * Taken from the Konverz title row ("… July to December 2026") rather than assumed.
 * The parser then cross-checks it against every weekday-prefixed date and refuses the
 * import if they disagree, so a wrong guess here cannot get through quietly.
 */
function yearFrom(rows: SheetRow[]): number {
  for (const row of rows.slice(0, 3)) {
    for (const cell of row) {
      const m = /\b(20\d{2})\b/.exec(String(cell ?? ""));
      if (m) return Number(m[1]);
    }
  }
  return new Date(TODAY).getFullYear();
}

async function main() {
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  if (!fs.existsSync(FILE)) die(`no workbook at ${FILE}`);
  const sheets = await readXlsxFile(FILE);
  const names = sheets.map((s: any) => s.sheet);
  console.log(`workbook  ${FILE}`);
  console.log(`sheets    ${names.join(", ")}`);
  console.log(`today     ${TODAY}${WRITE ? "" : "   (dry run — nothing will be written)"}`);

  const konverzRows = (sheets.find((s: any) => s.sheet === "Konverz AI") as any)?.data as SheetRow[] | undefined;
  if (!konverzRows) die('the workbook has no "Konverz AI" sheet');
  const year = yearFrom(konverzRows);
  console.log(`year      ${year} (from the sheet title; cross-checked against every stated weekday)`);

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  let failures = 0;

  for (const job of JOBS) {
    console.log(`\n${"─".repeat(72)}\n${job.spec.id}  ·  sheet "${job.sheet}"  →  store key "${job.storeKey}"\n${"─".repeat(72)}`);

    // Select by name, never by index: index 1 is the hidden production tracker.
    const found = sheets.find((s: any) => s.sheet === job.sheet) as any;
    if (!found) { console.error(`  ✖ no sheet named "${job.sheet}" — skipped`); failures++; continue; }

    const { data: row, error } = await sb
      .from("store")
      .select("key,value,version,updated_at,updated_by")
      .eq("key", job.storeKey)
      .maybeSingle();
    if (error) { console.error(`  ✖ could not read ${job.storeKey}: ${error.message}`); failures++; continue; }
    if (!row) { console.error(`  ✖ no store row for ${job.storeKey}`); failures++; continue; }

    // Backup first, always — before parsing, before any decision about writing.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = path.join(BACKUP_DIR, `${job.storeKey}-${stamp}.json`);
    fs.writeFileSync(backup, JSON.stringify(row, null, 2));
    console.log(`  backup    ${backup}`);

    const blob = (row.value ?? {}) as { version?: number; items?: unknown };
    let existing: ContentItem[] = Array.isArray(blob.items) ? (blob.items as ContentItem[]) : [];
    console.log(`  store     version=${row.version}  updated_by=${row.updated_by ?? "—"}  existing items=${existing.length}`);

    // migrateLegacyPlan decides how to read the whole array from items[0] alone. If the
    // stored rows are the old PlanItem shape, prepending modern ones flips that decision
    // and the old rows get rewritten. Stop instead.
    if (existing.length && !(typeof existing[0]?.id === "string" && typeof existing[0]?.date === "string")) {
      console.error("  ✖ this calendar holds legacy-shaped items. Open it in the app once to migrate, then re-run.");
      failures++;
      continue;
    }

    const already = existing.filter((i) => String(i.id ?? "").startsWith(`imp_${job.spec.id}_`));
    if (already.length && !REPLACE) {
      console.error(`  ✖ ${already.length} items from a previous import are already here. Re-run with --replace-imported to redo it.`);
      failures++;
      continue;
    }
    if (already.length && REPLACE) {
      console.log(`  replace   dropping ${already.length} previously imported items (edits to them are lost)`);
      existing = existing.filter((i) => !String(i.id ?? "").startsWith(`imp_${job.spec.id}_`));
    }

    const occupied = new Set(existing.map((i) => i.date).filter(Boolean));
    const result = job.parse(found.data as SheetRow[], job.spec, {
      year,
      now: new Date().toISOString(),
      occupied,
      notBefore: TODAY,
      // Rows whose sheet names no month at all go in the current month.
      fallbackMonth: new Date(`${TODAY}T12:00:00`).getMonth()
    });

    console.log(`  parsed    ${result.items.length} items`);
    for (const m of result.months) console.log(`     ${m.month}  ${String(m.dated).padStart(2)} dated  ${String(m.spread).padStart(2)} spread`);
    for (const s of result.skipped) console.log(`  skipped   row ${s.row}: ${s.reason}`);
    for (const [label, vals] of Object.entries(result.constants)) console.log(`  constant  ${label}: ${vals.join(", ")}`);

    if (result.notes.length) {
      console.log(`  notes     ${result.notes.length} cell(s) could not be mapped from the sheet's own vocabulary:`);
      const grouped = new Map<string, number[]>();
      for (const n of result.notes) {
        const k = `${n.column} ${n.kind}${n.value ? ` "${n.value}"` : ""}`;
        grouped.set(k, [...(grouped.get(k) ?? []), n.row]);
      }
      for (const [k, rowsHit] of grouped) console.log(`     ${k} — rows ${rowsHit.join(", ")}`);
    } else {
      console.log("  notes     none — every value mapped");
    }

    const merged = [...result.items, ...existing];
    console.log(`  result    ${existing.length} existing + ${result.items.length} imported = ${merged.length} items`);

    if (!WRITE) { console.log("  → dry run, nothing written"); continue; }

    const payload = { version: 3, items: merged, updatedAt: new Date().toISOString() };
    const { data: wrote, error: writeErr } = await sb
      .from("store")
      .update({ value: payload, updated_at: new Date().toISOString(), updated_by: ACTOR, version: row.version + 1 })
      .eq("key", job.storeKey)
      .eq("version", row.version)
      .select("version")
      .maybeSingle();

    if (writeErr) { console.error(`  ✖ write failed: ${writeErr.message}`); failures++; continue; }
    // The API route degrades to an unversioned upsert when the version column is missing.
    // A script must not: a null here means somebody else saved while we were working.
    if (!wrote) { console.error("  ✖ the calendar changed while this ran. Nothing written — re-run."); failures++; continue; }
    console.log(`  ✔ written  store.version ${row.version} → ${wrote.version}`);
  }

  console.log("");
  if (failures) die(`${failures} calendar(s) not imported.`);
  if (!WRITE) console.log("Dry run complete. Re-run with --write to apply.");
  else console.log("Import complete. Ask anyone with the calendar open to reload.");
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
