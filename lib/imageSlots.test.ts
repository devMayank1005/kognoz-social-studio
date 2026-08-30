import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FORMATS, type FormatId } from "./formats";

// ---------------------------------------------------------------------------
// The photo controls and the renderers have to agree.
//
// Three separate bugs shipped from them disagreeing, and every one of them looked
// identical to the user: the import says it worked and the canvas does not change.
//
//   Montage   no ImageSlot, no photoKeyFor case, neither control rendered
//   Article   ImageSlot only inside `variant === 1`, so 2 looks in 3 dropped the photo
//   Story     photoKeyFor offered "story" but the slot needed photoOn, which only deck
//             formats could set — so it could never appear
//
// These parse the source because the alternative is rendering the whole editor. They
// are deliberately about STRUCTURE, not pixels: does the key the editor writes have a
// reader, and is that reader reachable on every look the format can show?
// ---------------------------------------------------------------------------

const root = join(__dirname, "..");
const slideSrc = readFileSync(join(root, "components/Slide.tsx"), "utf8");
const studioSrc = readFileSync(join(root, "components/Studio.tsx"), "utf8");

/** The body of one `if (kind === "x") { … }` renderer branch. */
function branch(kind: string): string {
  const start = slideSrc.indexOf(`if (kind === "${kind}")`);
  expect(start, `no renderer branch for kind "${kind}"`).toBeGreaterThan(-1);
  const next = [...slideSrc.matchAll(/if \(kind === "/g)]
    .map((m) => m.index as number)
    .find((i) => i > start);
  return slideSrc.slice(start, next ?? slideSrc.length);
}

describe("photoKeyFor offers no key the renderers cannot read", () => {
  it("Montage has an ImageSlot per frame", () => {
    const montage = branch("montage");
    expect(montage).toContain("ImageSlot");
    expect(montage).toMatch(/setImg\(`m\$\{i\}`/);
    expect(montage).toMatch(/images\[`m\$\{i\}`\]/);
  });

  it("Studio knows Montage can take a photo", () => {
    const fn = studioSrc.slice(studioSrc.indexOf("const photoKeyFor"), studioSrc.indexOf("async function importImageUrl"));
    expect(fn).toContain('fmt.single === "montage"');
    expect(fn).toContain('fmt.single === "story"');
    expect(fn).toContain('fmt.single === "article"');
  });

  it("the Add photo toggle is offered wherever a photo key exists", () => {
    // Was `fmt.deck && !fmt.idea && …`, which is why Story could never reveal its slot.
    expect(studioSrc).not.toMatch(/\{fmt\.deck && !fmt\.idea && \(cur\.kind === "cover" \|\| cur\.kind === "content"\) && \(\s*\n\s*<div onClick=\{\(\) => setImgOn/);
    expect(studioSrc).toMatch(/\{photoKeyFor\(\) && \(\s*\n\s*<div onClick=\{\(\) => setImgOn/);
  });

  it("Story's slot appears for an imported photo, not only for the toggle", () => {
    const story = branch("story");
    expect(story).toMatch(/\(photoOn \|\| images\.story\)/);
  });

  it("every Article look can show a photo, so Next look cannot hide one", () => {
    const article = branch("article");
    // Three layouts, three returns, one shared gate.
    expect(article).toContain("showArticlePhoto");
    const gated = article.match(/showArticlePhoto && articleSlot\(/g) || [];
    expect(gated.length, "each of the three article variants needs its own slot").toBe(3);
    expect(article).not.toMatch(/if \(variant === 1\)[\s\S]{0,400}<ImageSlot img=\{images\.article\}/);
  });
});

describe("formats that offer no photo do not claim to", () => {
  const noPhoto: FormatId[] = ["Stat Card", "Says vs Does", "Dialogue", "Video", "Founder Video", "Idea Deck"];

  it("their renderers contain no image slot", () => {
    const kinds: Record<string, string> = {
      "Stat Card": "stat",
      "Says vs Does": "split",
      Dialogue: "dialogue",
      Video: "video",
      "Founder Video": "script"
    };
    for (const f of noPhoto) {
      const kind = kinds[f];
      if (!kind) continue;
      expect(branch(kind), `${f} renders an ImageSlot but photoKeyFor returns null for it`).not.toContain("ImageSlot");
    }
  });

  it("the help text no longer promises a photo area on every format", () => {
    expect(studioSrc).not.toContain("Click any image area to drop in a photo.");
    expect(studioSrc).toContain("Photo slots appear on");
  });
});

describe("Montage exports as whole frames", () => {
  it("is declared as a 3-frame format that divides evenly", () => {
    expect(FORMATS.Montage.frames).toBe(3);
    expect(FORMATS.Montage.w % 3).toBe(0);
  });

  it("the renderer builds fixed frame-width columns rather than a padded flex row", () => {
    const montage = branch("montage");
    expect(montage).toContain("baseW / 3");
    expect(montage).toContain("flexShrink: 0");
    // The old row is what pushed card three across the cut at x=2160.
    expect(montage).not.toContain("gap: 120");
    expect(montage).not.toContain("maxWidth: 900");
  });

  it("every frame carries the logo, so none exports unbranded", () => {
    const montage = branch("montage");
    // One Logo inside the per-frame map, not one for the whole strip.
    expect(montage.match(/<Logo /g) || []).toHaveLength(1);
    expect(montage.indexOf("<Logo ")).toBeGreaterThan(montage.indexOf("pts.map("));
  });
});
