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
  it("Montage takes one wide photo across the whole strip", () => {
    // Was one slot per frame. Three unrelated pictures fought the continuous read, so
    // it is now a single image panned across the three swipes.
    const montage = branch("montage");
    expect(montage).toContain("ImageSlot");
    expect(montage).toContain('setImg("montage"');
    expect(montage).toContain("images.montage");
    expect(montage).not.toMatch(/setImg\(`m\$\{i\}`/);
    // Full-bleed and behind the frames, which is what makes the empty slot clickable
    // across the whole canvas.
    expect(montage).toContain('style={{ position: "absolute", inset: 0, background: wide ? "transparent" : undefined }}');
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
    expect(montage).toContain("baseW / FRAMES");
    expect(montage).toContain("flexShrink: 0");
    // The old row is what pushed card three across the cut at x=2160.
    expect(montage).not.toContain("gap: 120");
    expect(montage).not.toContain("maxWidth: 900");
  });

  it("the mark is rendered once, not on every frame", () => {
    // The reverse of what this asserted before, and deliberately. Each frame carrying
    // its own logo made the strip read as three separate cards; the ask was for one
    // continuous piece, signed at the end. frameRoles decides, and lib/montage.test.ts
    // pins it to the last frame.
    const montage = branch("montage");
    expect(montage).toContain("frameRoles(i, FRAMES)");
    expect(montage).toContain("role.logo ? <Logo");
    expect(montage).toContain("role.cta ?");
    expect(montage).toContain("role.eyebrow ?");
  });

  it("the headline is split across the frames, never cut mid-word", () => {
    const montage = branch("montage");
    expect(montage).toContain("splitAcrossFrames(cover, FRAMES)");
    expect(montage).toContain("renderEm(phrases[i])");
    // The whole cover on one frame is the old layout.
    expect(montage).not.toContain("renderEm(cover)");
  });

  it("the three phrases share one size and one baseline", () => {
    // Sizing each phrase on its own gave three different font sizes on an uneven split,
    // which reads as three headlines rather than one line across the strip. The size is
    // computed once, from the widest phrase, outside the per-frame loop.
    const montage = branch("montage");
    expect(montage).toContain("fit(92, longestPhrase(phrases), 24)");
    expect(montage).not.toMatch(/fit\(\s*92\s*,\s*phrases\[i\]/);
    expect(montage).toContain("fontSize: headSize");
    // A fixed band, bottom-aligned, so a wrapped phrase does not shift its own card.
    expect(montage).toContain("height: headBandH");
    expect(montage).toContain('alignItems: "flex-end"');
  });

  it("the line opens at the left margin and closes at the right", () => {
    const montage = branch("montage");
    expect(montage).toContain("headlineAlign(i, FRAMES)");
    // Alignment drives both the block and the text inside it, so a wrapped phrase
    // aligns the same way its box does.
    expect(montage).toContain("justifyContent: align ===");
    expect(montage).toContain("textAlign: align ===");
  });

  it("carries continuity devices that are designed to cross the cuts", () => {
    const montage = branch("montage");
    // Petals centred on the cuts at 1080 and 2160 — decoration, so a half of one is a
    // shape completing on the next swipe rather than a clipped element.
    expect(montage).toContain("left: frameW - 380");
    expect(montage).toContain("left: frameW * 2 - 340");
    // A ground that drifts left to right across the full width.
    expect(montage).toContain("linear-gradient(90deg");
  });
});
