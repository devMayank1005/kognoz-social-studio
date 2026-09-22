import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StudioLayout, MonoChip, FieldLabel } from "./studio/StudioLayout";
import { SlideList, SlidePager } from "./studio/SlideStrip";
import { Inspector, InspectorField } from "./studio/Inspector";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const slides = [
  { n: 1, title: "AI skills don't create AI-ready organisations" },
  { n: 2, title: "The training illusion" },
  { n: 3, title: "" }
];

describe("StudioLayout", () => {
  it("renders the canvas and the inspector", () => {
    // Two columns, not three: the 240px generation rail was folded into the inspector's
    // Content and Design tabs, and `left` is gone from the props entirely.
    const out = html(<StudioLayout center={<p>CENTER</p>} right={<p>RIGHT</p>} />);
    expect(out).toContain("CENTER");
    expect(out).toContain("RIGHT");
  });

  it("omits the sub-header bar when the page supplies none", () => {
    expect(html(<StudioLayout center={null} right={null} />)).not.toContain("h-12");
  });

  it("pins itself under the 64px topbar so each column scrolls on its own", () => {
    // Letting the page scroll takes the canvas out of view while you edit a long body.
    expect(html(<StudioLayout center={null} right={null} />)).toContain("h-[calc(100vh-64px)]");
  });
});

describe("SlideList and SlidePager agree", () => {
  it("pads numbers so the column stays straight past nine slides", () => {
    const out = html(<SlideList slides={slides} current={0} onSelect={() => {}} />);
    expect(out).toContain("01");
    expect(out).toContain("02");
  });

  it("counts the slides in its heading", () => {
    expect(html(<SlideList slides={slides} current={0} onSelect={() => {}} />)).toContain("Slides (3)");
  });

  it("marks exactly one row current, in both places", () => {
    for (const el of [
      <SlideList key="l" slides={slides} current={1} onSelect={() => {}} />,
      <SlidePager key="p" slides={slides} current={1} onSelect={() => {}} />
    ]) {
      expect((html(el).match(/aria-current="true"/g) || []).length).toBe(1);
    }
  });

  it("shows a placeholder rather than an empty row for an untitled slide", () => {
    expect(html(<SlideList slides={slides} current={0} onSelect={() => {}} />)).toContain("Untitled");
  });

  it("pager reads the position in the reference's format", () => {
    expect(html(<SlidePager slides={slides} current={0} onSelect={() => {}} />)).toContain("01");
    expect(html(<SlidePager slides={slides} current={0} onSelect={() => {}} />)).toContain("03");
  });

  it("renders nothing rather than an empty pager for an empty deck", () => {
    expect(html(<SlidePager slides={[]} current={0} onSelect={() => {}} />)).toBe("");
  });

  it("labels the arrows for screen readers", () => {
    const out = html(<SlidePager slides={slides} current={0} onSelect={() => {}} />);
    expect(out).toContain('aria-label="Previous slide"');
    expect(out).toContain('aria-label="Next slide"');
  });
});

describe("Inspector", () => {
  it("renders three tabs with exactly one selected", () => {
    const out = html(<Inspector tab="content" onTab={() => {}}>body</Inspector>);
    for (const l of ["Content", "Design", "AI"]) expect(out).toContain(l);
    expect((out.match(/aria-selected="true"/g) || []).length).toBe(1);
  });

  it("uses real tab semantics, not styled divs", () => {
    const out = html(<Inspector tab="design" onTab={() => {}}>body</Inspector>);
    expect(out).toContain('role="tablist"');
    expect(out).toContain('role="tab"');
  });

  it("counts characters live, because the frame is a fixed size", () => {
    const out = html(
      <InspectorField label="Headline" value="Twelve chars">
        <textarea readOnly />
      </InspectorField>
    );
    expect(out).toContain("12 chars");
    expect(out).toContain("Headline");
  });

  it("reports zero for an empty field rather than hiding the count", () => {
    expect(html(<InspectorField label="Body" value=""><input readOnly /></InspectorField>)).toContain("0 chars");
  });
});

describe("shared chrome bits", () => {
  it("MonoChip and FieldLabel render their content", () => {
    expect(html(<MonoChip>Idea Deck · 7 slides</MonoChip>)).toContain("Idea Deck · 7 slides");
    expect(html(<FieldLabel>Format</FieldLabel>)).toContain("Format");
  });
});
