import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The rule Tailwind was admitted under.
//
// lib/exportPipeline.ts serialises a slide into an SVG <foreignObject> and strips
// <style> tags, so ONLY INLINE STYLES survive rasterisation. A Tailwind class on a slide
// element would render perfectly in the browser and produce an unstyled box in the
// exported PNG — and nobody would find out until a published carousel looked wrong.
//
// So: chrome uses Tailwind, the slide renderer does not. These guards are cheap and the
// failure they prevent is expensive and silent.

const read = (...parts: string[]) => readFileSync(join(__dirname, "..", ...parts), "utf8");

describe("the slide renderer stays inline-styles-only", () => {
  it("components/Slide.tsx has no className", () => {
    const src = read("components", "Slide.tsx");
    const hits = [...src.matchAll(/className\s*=/g)];
    expect(hits, `Slide.tsx gained ${hits.length} className(s) — those will not survive export`).toHaveLength(0);
  });

  it("components/Slide.tsx still styles with inline objects", () => {
    // The positive half: proves the file is actually styled, so a future refactor that
    // emptied it could not pass the check above by accident.
    expect(read("components", "Slide.tsx").match(/style=\{\{/g)?.length ?? 0).toBeGreaterThan(50);
  });
});

describe("preflight is not imported", () => {
  const css = read("app", "globals.css");

  it("globals.css imports the utilities layer but not preflight", () => {
    expect(css).toContain('@import "tailwindcss/utilities.css"');
    expect(css).toContain('@import "tailwindcss/theme.css"');
    // Importing preflight — directly, or via the umbrella "tailwindcss" entry which
    // includes it — would reset base elements app-wide, including inside the slide.
    expect(css).not.toContain('"tailwindcss/preflight.css"');
    expect(css).not.toMatch(/@import\s+"tailwindcss"\s*;/);
  });

  it("says why, so the next person does not 'fix' it", () => {
    expect(css).toMatch(/preflight is deliberately NOT imported/i);
  });
});
