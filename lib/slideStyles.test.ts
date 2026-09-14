import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raw = readFileSync(join(process.cwd(), "components/Slide.tsx"), "utf8");

// Comments explain the trap by quoting it, so a naive scan matches the warning
// rather than the defect. Strip line comments before looking for real code.
const slideSrc = raw
  .split("\n")
  .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
  .join("\n");

// ---------------------------------------------------------------------------
// The gradient word, and the CSS ordering that silently breaks it.
//
// `background` is a shorthand: it resets `background-clip` to `border-box`. React
// writes style objects in key order, so
//
//     { ...BASE_EM_STYLE, background: GRAD }     // background LAST — broken
//
// undoes the clip, and the marked word renders as a solid gradient rectangle with
// invisible text sitting on it. Nothing throws, no test failed, and the defect is
// only visible by looking at a rendered slide — which is how it shipped here once
// already, during the Konverz port.
//
// The correct spread puts the shorthand first:
//
//     { background: GRAD, ...BASE_EM_STYLE }     // background FIRST — correct
// ---------------------------------------------------------------------------
describe("the gradient word", () => {
  it("never spreads the base style after `background`", () => {
    const bad = slideSrc.match(/\{\s*\.\.\.BASE_EM_STYLE\s*,\s*background/g);
    expect(bad, "background after the spread resets background-clip and kills the clip").toBeNull();
  });

  it("every em style puts the shorthand before the clip", () => {
    const spreads = slideSrc.match(/\{\s*background:[^}]*\.\.\.BASE_EM_STYLE\s*\}/g) || [];
    expect(spreads.length, "expected the em style to still be built by spreading BASE_EM_STYLE").toBeGreaterThanOrEqual(2);
  });

  // The same trap in longhand, where the clip is written inline rather than spread.
  it("inline gradient-text blocks declare background before background-clip", () => {
    const inline = slideSrc.match(/background:\s*GRAD[^}]*?BackgroundClip/g) || [];
    const reversed = slideSrc.match(/BackgroundClip:\s*"text"[^}]*?\bbackground:\s*GRAD/g) || [];
    expect(inline.length, "expected inline gradient-text styles to exist").toBeGreaterThan(0);
    expect(reversed, "a gradient shorthand written after the clip cancels it").toEqual([]);
  });

  it("keeps both the prefixed and unprefixed clip, in that order", () => {
    const i = slideSrc.indexOf("WebkitBackgroundClip");
    const j = slideSrc.indexOf("backgroundClip", i);
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
  });
});
