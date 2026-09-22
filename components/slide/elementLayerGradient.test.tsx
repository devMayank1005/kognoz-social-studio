// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ElementLayer from "./ElementLayer";
import { createShape, type ShapeElement, type SlideElement } from "@/lib/slideElements";

// Gradient fills, and the one question they had to answer before they could ship.
//
// elementLayer.test.tsx states the rule this feature could have broken: "Only img, br and
// input are XML-normalised by the exporter. Any other self-closing tag throws and takes the
// whole slide's export with it." A <linearGradient> is full of <stop> children, so this is
// exactly the feature that could reintroduce that failure.
//
// This file is jsdom rather than node for one reason: it gives us a real DOMParser, so the
// markup can be parsed the way lib/exportPipeline.ts:110 parses it instead of string-matched
// and hoped over. Everything else about ElementLayer stays in the node file next door.

const html = (els: SlideElement[]) =>
  renderToStaticMarkup(<ElementLayer elements={els} baseW={1080} baseH={1350} hideId={null} />);

describe("a gradient fill survives the export, and is checked rather than assumed", () => {
  // THE RISK THIS FILE ALREADY NAMES, arriving through a new door. The test above says:
  // "Only img, br and input are XML-normalised by the exporter. Any other self-closing tag
  // throws and takes the whole slide's export with it." A <linearGradient> is full of
  // <stop> children, so a gradient fill is precisely the feature that could reintroduce it.
  //
  // <stop> is not an HTML void element, so both serialisers should close it — but "should"
  // is what the synthesised-font bug was built on, so this parses the markup as XML exactly
  // as lib/exportPipeline.ts:110 does instead of matching strings and hoping.

  const gradient = {
    type: "linear" as const,
    angle: 120,
    stops: [
      { color: "#43afcd", at: 0 },
      { color: "rgba(0, 0, 0, 0.5)", at: 50 },
      { color: "#75a02f", at: 100 }
    ]
  };

  const withGradient = (over: Partial<ShapeElement> = {}) =>
    html([createShape([], "rect", { id: "el_1", w: 240, h: 180, fillGradient: gradient, ...over })]);

  /**
   * The exporter's own string steps, then its own XML check.
   *
   * Mirrors lib/exportPipeline.ts:70-77 — the five regexes and the foreignObject wrapper —
   * so what is parsed here is what the rasteriser is actually handed.
   */
  function parsesAsXml(markup: string): string | null {
    const cleaned = markup
      .replace(/<input[^>]*>/g, "")
      .replace(/<img([^>]*?)\s*\/?>/g, "<img$1/>")
      .replace(/<br\s*>/g, "<br/>")
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/&nbsp;/g, "&#160;");
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">` +
      `<foreignObject width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:1080px;height:1350px;">${cleaned}</div>` +
      `</foreignObject></svg>`;
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    return doc.querySelector("parsererror")?.textContent ?? null;
  }

  it("parses as XML, which is the check the exporter actually runs", () => {
    expect(parsesAsXml(withGradient())).toBeNull();
  });

  it("closes every <stop> instead of self-closing it", () => {
    // A self-closing <stop/> would parse here but is the shape of tag that has broken the
    // export before, so it is pinned explicitly as well as parsed.
    const out = withGradient();
    expect(out).toContain("</stop>");
    expect(out).not.toMatch(/<stop[^>]*\/>/);
  });

  it("introduces no new void element, gradient or not", () => {
    const out = withGradient();
    for (const tag of ["hr", "wbr", "col", "source", "embed", "area", "track"]) {
      expect(out, `<${tag}> would break XML parsing`).not.toMatch(new RegExp(`<${tag}\\b`));
    }
  });

  it("points the fill at the ramp rather than at a CSS gradient string", () => {
    // An SVG fill attribute takes a paint. Handing it `linear-gradient(…)` draws nothing —
    // the shape is simply absent from the PNG, with no error anywhere.
    const out = withGradient();
    expect(out).toContain('fill="url(#kz-grad-el_1)"');
    expect(out).not.toContain("linear-gradient");
    expect(out).toContain('<linearGradient id="kz-grad-el_1"');
  });

  it("splits a translucent stop into colour and opacity, as SVG wants them", () => {
    const out = withGradient();
    expect(out).toContain('stop-color="#000000"');
    expect(out).toContain('stop-opacity="0.5"');
    expect(out).not.toContain("rgba(");
  });

  it("keeps xmlns on the svg, without which the shape silently draws nothing", () => {
    expect(withGradient()).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("carries no className, same as everything else in here", () => {
    expect(withGradient()).not.toContain("class=");
  });

  it("draws a radial through radialGradient, not a rotated linear one", () => {
    const out = html([
      createShape([], "ellipse", { id: "el_2", fillGradient: { ...gradient, type: "radial" } })
    ]);
    expect(out).toContain("<radialGradient");
    expect(out).not.toContain("<linearGradient");
    expect(parsesAsXml(out)).toBeNull();
  });

  it("works on a library shape too, not only the three original kinds", () => {
    const out = html([createShape([], "star", { id: "el_3", fillGradient: gradient })]);
    expect(out).toContain('fill="url(#kz-grad-el_3)"');
    expect(parsesAsXml(out)).toBeNull();
  });

  it("gives two shapes two ramps, so neither steals the other's colours", () => {
    // SVG ids are document-global. Keying them to the element id is what keeps them apart.
    const out = html([
      createShape([], "rect", { id: "el_1", fillGradient: gradient }),
      createShape([], "rect", { id: "el_2", fillGradient: { ...gradient, angle: 0 } })
    ]);
    expect(out).toContain('id="kz-grad-el_1"');
    expect(out).toContain('id="kz-grad-el_2"');
  });

  it("falls back to the solid fill when the gradient is not drawable", () => {
    // One stop is not a gradient. Rendering the solid colour beats rendering nothing.
    const out = html([
      createShape([], "rect", {
        id: "el_1",
        fill: "#ff0000",
        fillGradient: { ...gradient, stops: [gradient.stops[0]] }
      })
    ]);
    expect(out).toContain('fill="#ff0000"');
    expect(out).not.toContain("linearGradient");
  });

  it("leaves a shape with no gradient exactly as it was before this feature", () => {
    // The whole point of splitting alpha only when it is strictly between 0 and 1: every
    // deck saved before today exports byte-for-byte the same markup.
    const plain = html([createShape([], "rect", { id: "el_1", fill: "#ff0000", stroke: "transparent" })]);
    expect(plain).toContain('fill="#ff0000"');
    expect(plain).toContain('stroke="transparent"');
    expect(plain).not.toContain("fill-opacity");
  });

  it("splits a translucent solid fill, because SVG takes opacity separately", () => {
    const out = html([createShape([], "rect", { id: "el_1", fill: "rgba(255, 0, 0, 0.25)" })]);
    expect(out).toContain('fill="#ff0000"');
    expect(out).toContain('fill-opacity="0.25"');
    expect(parsesAsXml(out)).toBeNull();
  });
});
