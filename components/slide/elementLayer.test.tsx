import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ElementLayer from "./ElementLayer";
import { createShape, createText, type SlideElement } from "@/lib/slideElements";

// What this file is for.
//
// ElementLayer renders inside the node lib/exportPipeline.ts clones, so its markup has to
// survive being serialised to a string, re-parsed as XML, and rasterised through an SVG
// <foreignObject>. Nothing in this repo can actually run that pipeline under vitest, so
// these assertions stand in for it: each one mirrors a specific rule in the exporter.

const html = (els: SlideElement[], hideId?: string | null) =>
  renderToStaticMarkup(<ElementLayer elements={els} baseW={1080} baseH={1350} hideId={hideId} />);

const aText = createText([], { id: "el_1", text: "Hello", x: 10, y: 20, w: 300, h: 100 });
const aRect = createShape([], "rect", { id: "el_2", x: 40, y: 50 });

describe("ElementLayer export safety", () => {
  it("renders nothing at all when the slide has no elements", () => {
    // A slide nobody has touched must serialise exactly as it did before this feature.
    expect(html([])).toBe("");
  });

  it("carries no className — a class would export as an unstyled box", () => {
    expect(html([aText, aRect])).not.toMatch(/class=/);
  });

  it("styles everything inline", () => {
    const out = html([aText]);
    expect(out).toContain("position:absolute");
    expect(out).toContain("left:10px");
    expect(out).toContain("top:20px");
  });

  it("puts an explicit xmlns on every svg", () => {
    // Re-parsed as XML in the XHTML namespace, an svg without its own namespace draws
    // nothing — the shape would simply be missing from the PNG.
    const out = html([aRect, createShape([], "ellipse", { id: "el_3" }), createShape([], "line", { id: "el_4" })]);
    const svgs = [...out.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
    expect(svgs).toHaveLength(3);
    for (const tag of svgs) expect(tag).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("emits no <input>, which the sanitiser deletes unconditionally", () => {
    expect(html([aText, aRect])).not.toMatch(/<input/);
  });

  it("introduces no void element beyond img and br", () => {
    // Only img, br and input are XML-normalised by the exporter. Any other self-closing
    // tag throws "XML: ..." and takes the whole slide's export with it.
    const out = html([aText, aRect, createShape([], "line", { id: "el_9" })]);
    for (const tag of ["hr", "wbr", "col", "source", "embed", "area", "track"]) {
      expect(out, `<${tag}> would break XML parsing`).not.toMatch(new RegExp(`<${tag}\\b`));
    }
  });

  it("writes rotation as an inline transform, which foreignObject honours", () => {
    expect(html([createText([], { id: "el_1", rot: 12 })])).toMatch(/transform:rotate\(12deg\)/);
  });

  it("leaves transform off entirely when nothing is rotated", () => {
    expect(html([aText])).not.toMatch(/transform:rotate/);
  });
});

describe("ElementLayer ordering and hiding", () => {
  it("draws in z order, using DOM order rather than z-index", () => {
    // z-index inside foreignObject opens a stacking context that does not always behave
    // the way it does on screen; document order is unambiguous in both.
    const out = html([
      createText([], { id: "el_1", z: 2, text: "SECOND" }),
      createText([], { id: "el_2", z: 1, text: "FIRST" })
    ]);
    expect(out).not.toMatch(/z-index/);
    expect(out.indexOf("FIRST")).toBeLessThan(out.indexOf("SECOND"));
  });

  it("hides only the element being dragged, and only when asked", () => {
    expect(html([aText, aRect], "el_1")).not.toContain("Hello");
    expect(html([aText, aRect], "el_1")).toMatch(/<svg/);
    expect(html([aText, aRect])).toContain("Hello");
  });
});

const render = (els: SlideElement[], editingId?: string | null) =>
  renderToStaticMarkup(<ElementLayer elements={els} baseW={1080} baseH={1350} editingId={editingId} />);

describe("inline text editing", () => {
  it("never marks anything editable in the export tree", () => {
    // `editingId` is threaded only at the preview mount. The exporter's sanitiser does not
    // strip `contenteditable`, and a valueless one is invalid XML — it would kill the export.
    expect(render([aText, aRect])).not.toMatch(/contenteditable/i);
  });

  it("marks exactly the element being typed into", () => {
    const out = render([aText, aRect], "el_1");
    expect((out.match(/contenteditable/gi) ?? []).length).toBe(1);
  });

  it("hands the editable no children, because React must not own them under a caret", () => {
    // Re-rendering children while a caret is live collapses the selection to the start on
    // every keystroke. The node is filled imperatively when editing begins instead.
    expect(render([aText], "el_1")).not.toContain("Hello");
  });

  it("still renders the words normally when nothing is being edited", () => {
    expect(render([aText])).toContain("Hello");
  });
});

describe("template markup", () => {
  it("renders the markup an unlocked template element carries", () => {
    // The gradient word from a cover headline. Flattening it to text is what made unlocking
    // visibly change the slide.
    const withHtml = createText([], {
      id: "el_9",
      html: '<span style="color:red">do</span>',
      text: "do"
    });
    expect(render([withHtml])).toContain('<span style="color:red">do</span>');
  });

  it("leaves a hand-made text box as plain text", () => {
    const out = render([aText]);
    expect(out).toContain("Hello");
    expect(out).not.toContain("<span");
  });
});

describe("text layout", () => {
  it("is block, not flex — a contentEditable flex box puts the caret in the wrong place", () => {
    expect(render([aText])).toContain("display:block");
  });

  it("never clips, so text typed past the edge is not swallowed", () => {
    expect(render([aText])).not.toContain("overflow:hidden");
  });
});
