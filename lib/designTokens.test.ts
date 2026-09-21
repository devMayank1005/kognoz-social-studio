import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { C, GRAD } from "./tokens";

// ---------------------------------------------------------------------------
// One palette, declared twice, kept identical by this file.
//
// It has to be declared twice. components/Slide.tsx renders with inline styles because the
// exporter strips <style>, so it needs the values as a JS object; the chrome needs them as
// CSS variables so a brand switch can repaint the frame by changing one attribute. Neither
// can read the other's format.
//
// What is NOT acceptable is a third copy, and that is what had happened: the same five
// hexes were hard-coded as Tailwind arbitrary values (`bg-[#43AFCD]`) in eleven production
// files, because overlays could reach neither system. This test exists to stop the two
// legitimate copies drifting, and the lint below to stop a third appearing.
// ---------------------------------------------------------------------------

const root = process.cwd();
const css = readFileSync(join(root, "app/globals.css"), "utf8");

/** `--color-ink-soft` -> `inkSoft` */
const camel = (name: string) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function cssVars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const vars = cssVars(rootBlock);

describe("the palette in globals.css matches lib/tokens.ts", () => {
  it("declares every colour the token object defines", () => {
    const missing = Object.keys(C).filter((key) => {
      if (key === "gradFrom" || key === "gradTo") return false; // carried by the gradient
      const name = key === "lineD" ? "--color-line-dark" : `--color-${key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`;
      return !(name in vars);
    });
    expect(missing, `tokens.ts has colours the stylesheet does not: ${missing.join(", ")}`).toEqual([]);
  });

  it("agrees on every value", () => {
    for (const [name, value] of Object.entries(vars)) {
      if (!name.startsWith("--color-")) continue;
      const key = name === "--color-line-dark" ? "lineD" : camel(name.replace("--color-", ""));
      const expected = (C as Record<string, string>)[key];
      expect(expected, `${name} has no counterpart in tokens.ts`).toBeTruthy();
      // Case differs between the two files and always has; the colour is what matters.
      expect(value.toLowerCase(), `${name} drifted from C.${key}`).toBe(expected.toLowerCase());
    }
  });

  it("agrees on the brand gradient", () => {
    expect(vars["--gradient-brand"]?.toLowerCase().replace(/\s+/g, " ")).toBe(GRAD.toLowerCase().replace(/\s+/g, " "));
  });
});

describe("no third copy of the palette", () => {
  // The failure this prevents, in its original form: the same five hexes literal-pasted
  // into eleven production files as Tailwind arbitrary values, because an overlay could
  // reach neither lib/tokens.ts (a TS object, unreadable from a class) nor the CSS
  // variables (unreadable from a JS style object). Chrome now uses var(--color-*);
  // anything rendering into a slide imports C. Neither needs a literal.
  const BRAND_HEXES = ["#005184", "#43AFCD", "#88B787", "#55B09D", "#009BDD", "#75A02F", "#0A6E8F"];

  /** The two files allowed to state the palette, and the tests that assert on it. */
  const ALLOWED = /^(lib\/tokens\.ts|lib\/brands\.ts|.*\.test\.tsx?|app\/globals\.css)$/;

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel, out);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
    }
    return out;
  }

  it("is not hiding in any component, route or library file", () => {
    const offenders: string[] = [];
    for (const file of [...walk("components"), ...walk("app"), ...walk("lib")]) {
      if (ALLOWED.test(file)) continue;
      const src = readFileSync(join(root, file), "utf8");
      for (const hex of BRAND_HEXES) {
        if (new RegExp(hex, "i").test(src)) offenders.push(`${file} contains ${hex}`);
      }
    }
    expect(
      offenders,
      `use var(--color-*) in chrome, or import C from lib/tokens.ts:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });
});
