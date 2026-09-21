import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// A control inventory for Studio.tsx.
//
// WHY THIS EXISTS. Studio is being re-laid-out from two columns into three, which means
// its 685-line control rail gets split across a left column and a right inspector. That
// is precisely the edit where a control gets silently dropped — and nothing else would
// catch it. The type checker sees no error because deleting JSX is valid. renderSmoke
// sees no error because the component still renders. The tests pass, the build is clean,
// and the grounding toggle is simply gone until someone notices weeks later that every
// generation is ungrounded.
//
// So: every control that existed before the move is listed here, and has to still exist
// after it. Source-level string matching is crude, but it is the only check that fails
// for the right reason — and the strings below are user-visible copy, so a match is
// meaningful rather than incidental.
//
// If a control is REMOVED ON PURPOSE, delete its line here in the same commit. That
// makes the removal a visible, reviewable decision instead of an accident.

const studio = readFileSync(join(__dirname, "Studio.tsx"), "utf8");

/** Section headings in the control rail. */
const SECTIONS = [
  "Deck style",
  "Content pillar",
  "Publishing as",
  "Topic",
  "Design set · one family per deck",
  "Accent tone",
  "Design elements",
  "Cover headline",
  "Closing / CTA",
  "Iterate on content",
  "Facts · checked against the live web before you publish",
  "The article itself"
];

/** Every text field someone types into. */
const PLACEHOLDERS = [
  "Slide title",
  "One idea for this slide",
  "Cover headline · mark one word *like this*",
  "Closing message or call to action",
  "Tell Claude what to change",
  "e.g. show the website on every slide",
  "Paste what you actually have"
];

/** Actions that cost money, change the deck, or produce a file. */
const ACTIONS = [
  "Regenerate afresh",
  "Revise content",
  "Verify facts",
  "Next look",
  "Add photo",
  "Image URL",
  "LinkedIn PDF",
  "LinkedIn PNGs",
  "Review strip",
  "Panorama",
  "House style",
  "Voice samples",
  "Grounded"
];

describe("no control is lost when Studio is re-laid-out", () => {
  it.each(SECTIONS)("keeps the %s section", (label) => {
    expect(studio).toContain(label);
  });

  it.each(PLACEHOLDERS)("keeps the field: %s", (placeholder) => {
    expect(studio).toContain(placeholder);
  });

  it.each(ACTIONS)("keeps the action: %s", (action) => {
    expect(studio).toContain(action);
  });
});

describe("the export hooks the pipeline depends on", () => {
  it("still renders the hidden full-resolution nodes by id", () => {
    // lib/exportPipeline.ts looks these up with getElementById. Rename or move them and
    // every export silently produces nothing — the canvas on screen is a preview at a
    // different size and is not what gets rasterised.
    expect(studio).toContain("exp-");
    expect(studio).toMatch(/id=\{`exp-\$\{/);
  });

  it("still calls every export path", () => {
    for (const fn of ["exportPdf", "exportPNG", "exportPanorama", "exportStrip", "exportFramesPdf"]) {
      expect(studio, `${fn} is no longer called`).toContain(`${fn}(`);
    }
  });

  it("passes the brand's font stylesheet to the exporters", () => {
    // Without it the export embeds Kognoz's faces into a Konverz deck.
    expect(studio).toContain("brand.googleFontsUrl");
  });
});

describe("the expensive paths stay deliberate", () => {
  it("keeps the grounded-search toggle", () => {
    // Grounding costs several times a plain call. It must remain a visible choice, not
    // something a layout change quietly turned on or removed.
    expect(studio).toContain("grounded");
    expect(studio).toContain("setGrounded");
  });

  it("keeps the deck snapshot that makes undo possible", () => {
    // Every AI action replaces state and wipes the browser's native undo stack.
    expect(studio).toContain("snapshotDeck");
    expect(studio).toContain("restoreDeck");
  });
});
