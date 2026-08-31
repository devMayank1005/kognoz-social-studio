import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FORMATS, type FormatId } from "./formats";
import { DESIGN_SETS } from "./designSets";

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

  it("Story shows a photo only while the toggle is on", () => {
    // Was `photoOn || images.story`, which meant that once a picture existed the toggle
    // could no longer hide it. Turning the photo off now hides it and KEEPS it, so
    // toggling back on restores the same image.
    const story = branch("story");
    expect(story).not.toMatch(/photoOn \|\| images\.story/);
    expect(story).toContain("{photoOn && (");
    // The full-bleed photo Story is an early return, and it needs the same gate.
    expect(story).toContain("if (photoOn && images.story)");
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

// ---------------------------------------------------------------------------
// The rule this file exists to defend:
//
//   A photo slot appears ONLY because the user asked for one — never because of a
//   design set, a seed, or state left behind by another format.
//
// It was broken three ways at once. `magazine` pins `cover: 99` and `contents: [8]`,
// both photo compositions, so Carousel and Square opened with an empty photo box on
// every slide — and because BOTH arms of `photoOn ? 99 : dset.cover` returned 99, the
// "Add photo" toggle had nothing to act on and did literally nothing. `mixed` reached
// the same content layout by seed on roughly one slide in eight, moving on every
// "Next look". And variant 8 rendered its slot as the EMPTY STATE of the image check,
// so the box appeared precisely because no picture existed.
// ---------------------------------------------------------------------------
describe("no photo slot without the user asking", () => {
  it("every ImageSlot sits behind a condition derived from photoOn", () => {
    const positions: number[] = [];
    for (let i = slideSrc.indexOf("<ImageSlot"); i !== -1; i = slideSrc.indexOf("<ImageSlot", i + 1)) positions.push(i);
    expect(positions.length, "expected the renderer to still have image slots").toBeGreaterThan(3);

    for (const at of positions) {
      const before = slideSrc.slice(Math.max(0, at - 900), at);
      const line = slideSrc.slice(0, at).split("\n").length;
      expect(before, `ImageSlot at Slide.tsx:${line} is not guarded by photoOn`).toMatch(/photoOn|showPhoto|showArticlePhoto/);
    }
  });

  it("the guard variables resolve to the toggle and nothing else", () => {
    // `photoOn || Boolean(images.x)` is the shape that let an existing image force a
    // slot back on after the user had switched it off.
    expect(slideSrc).toContain("const showArticlePhoto = photoOn;");
    expect(slideSrc).toContain("const showPhoto = photoOn;");
    expect(slideSrc).not.toMatch(/photoOn \|\| Boolean\(/);
  });

  it("no slot is rendered as the empty state of an image check", () => {
    // `bgImg ? <img/> : <ImageSlot/>` put a box on screen BECAUSE there was no picture.
    expect(slideSrc).not.toMatch(/\)\s*:\s*\(?\s*\n?\s*<ImageSlot/);
  });

  it("the design sets that pin photo compositions are gated inside them", () => {
    // magazine deliberately still pins 99 and [8] — those are its compositions, and
    // collapsing it to a text set would lose the look. What changed is that the photo
    // ELEMENT inside each is conditional, so magazine renders text-only until asked.
    expect(DESIGN_SETS.magazine.cover).toBe(99);
    expect(DESIGN_SETS.magazine.contents).toEqual([8]);
    const cover99 = slideSrc.slice(slideSrc.indexOf("if (variant === 99)"));
    expect(cover99.slice(0, 900)).toContain("{photoOn && (");
    const content8 = slideSrc.slice(slideSrc.indexOf("if (variant === 8)"));
    expect(content8.slice(0, 1200)).toContain("const bgImg = photoOn ? stored : null;");
  });

  it("photo intent does not travel between formats", () => {
    // imgOn is keyed by DECK index: index 0 is the cover on a deck and the whole asset
    // on a single format, so carrying it across revealed slots on untouched formats.
    const fn = studioSrc.slice(studioSrc.indexOf("const selectFormat"), studioSrc.indexOf("const accent ="));
    expect(fn).toContain("setImgOn({})");
  });
});

// ---------------------------------------------------------------------------
// renderEm() returns text interleaved with <span>s for the *emphasised* words. Making
// the heading itself a flex container turns those into flex items — the plain text
// becomes one anonymous item and each emphasised word a separate one beside it — so the
// emphasised word is thrown out of the line with a gap in front of it. It looks like a
// spacing bug and is actually a display-mode bug, and it is invisible until a headline
// happens to contain an emphasis marker.
//
// Centring belongs on a wrapper. Every cover in the renderer already does it that way.
// ---------------------------------------------------------------------------
describe("headings that render emphasis stay in normal text flow", () => {
  it("no h1 or h2 is itself a flex container", () => {
    for (const tag of ["h1", "h2"]) {
      let i = slideSrc.indexOf(`<${tag}`);
      while (i !== -1) {
        // The element's own style block: from the tag to the ">" that opens its content.
        const head = slideSrc.slice(i, slideSrc.indexOf(">", slideSrc.indexOf("}}", i)) + 1);
        const line = slideSrc.slice(0, i).split("\n").length;
        expect(head, `<${tag}> at Slide.tsx:${line} is display:flex — emphasis spans will break out of the line`).not.toMatch(
          /display:\s*"flex"/
        );
        i = slideSrc.indexOf(`<${tag}`, i + 1);
      }
    }
  });

  it("the magazine cover centres via a wrapper, not the heading", () => {
    // Bound the branch properly rather than guessing a character window.
    const start = slideSrc.indexOf("if (variant === 99)");
    const end = slideSrc.indexOf("if (variant === 2)", start);
    const cover99 = slideSrc.slice(start, end > start ? end : start + 3000);
    expect(cover99).toMatch(/<div style=\{\{ flex: 1, display: "flex", alignItems: photoOn/);
    expect(cover99).toContain("{renderEm(cover)}");
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

// A CSS animation runs once, when its element mounts. Replacing the copy re-rendered
// the SAME nodes, so the kinetic sequence kept the end state of an animation that had
// already finished — generating again while Video was selected showed no motion at all,
// and switching format and back was the only way to see it. The keys below remount the
// animated subtree so it replays.
describe("Video Kinetic replays when the content is replaced", () => {
  const video = () => {
    const start = slideSrc.indexOf('if (kind === "video")');
    expect(start).toBeGreaterThan(-1);
    const next = [...slideSrc.matchAll(/if \(kind === "/g)].map((m) => m.index as number).find((i) => i > start);
    return slideSrc.slice(start, next ?? slideSrc.length);
  };

  it("keys the animated subtree on the replay counter", () => {
    expect(video()).toContain("key={`kv-${replay}`}");
    expect(video()).toContain("key={`kv-foot-${replay}`}");
  });

  it("Studio bumps that counter wherever the deck is replaced wholesale", () => {
    // generate, revise, undo, apply-corrections and each cycleLook branch.
    expect(studioSrc).toContain("const bumpReplay =");
    expect((studioSrc.match(/bumpReplay\(\)/g) || []).length).toBeGreaterThanOrEqual(6);
    expect(studioSrc).toContain("replay={replay}");
  });

  it("still sets no inline opacity, so a stripped-keyframe export is not blank", () => {
    // The export pipeline removes <style>, so the keyframes are absent at export time.
    // `backwards` with no inline opacity is what makes the PNG render at full opacity.
    expect(video()).toContain("backwards");
    expect(video()).not.toMatch(/opacity:\s*0/);
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
