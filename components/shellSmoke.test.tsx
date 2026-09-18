import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleWriter } from "./ArticleWriter";
import { NAV_ICONS } from "./shell/navIcons";
import { Placeholder } from "./shell/Placeholder";
import { NAV_ITEMS } from "@/lib/navigation";

// Does the new chrome actually render?
//
// Same reasoning as renderSmoke.test.tsx: the type checker proves the props line up
// and the unit tests prove lib/navigation.ts is right, and between the two a component
// can still throw on mount and ship. renderToStaticMarkup needs no DOM and no new
// dependency.
//
// WHAT THIS CANNOT SEE, so a green run is not read as more than it is: no layout, no
// effects (the server pass skips them, so the draft restore is not exercised here), no
// interaction. Sidebar and Topbar are absent on purpose — they call usePathname() and
// useSession(), which need a Next router and a SessionProvider around them; testing
// them properly needs the browser, which is in the verification steps.

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("nav icons", () => {
  it("has a glyph for every destination, so no sidebar row is blank", () => {
    for (const item of NAV_ITEMS) {
      const Icon = NAV_ICONS[item.id];
      expect(Icon, `no icon for "${item.id}"`).toBeTruthy();
      const out = html(<Icon className="w-4 h-4" />);
      expect(out).toContain("<svg");
    }
  });

  it("renders icons that inherit colour from the row", () => {
    // The active/inactive colour is decided by the row, never hardcoded in the glyph.
    expect(html(<NAV_ICONS.studio className="w-4 h-4" />)).toContain('stroke="currentColor"');
  });
});

describe("Placeholder", () => {
  const out = html(
    <Placeholder
      title="Style & Voice"
      summary="A summary."
      willInclude={["First thing", "Second thing"]}
      todayInstead="Where it lives today."
    />
  );

  it("renders the title, every listed item, and the fallback note", () => {
    expect(out).toContain("Style &amp; Voice");
    expect(out).toContain("First thing");
    expect(out).toContain("Second thing");
    expect(out).toContain("Where it lives today.");
  });

  it("omits the fallback note when there is nothing useful to say", () => {
    const bare = html(<Placeholder title="T" summary="S" willInclude={["x"]} />);
    expect(bare).toContain("x");
    expect(bare).not.toContain("undefined");
  });
});

describe("ArticleWriter", () => {
  const base = {
    topic: "",
    pillar: "Human + AI",
    channel: "Kognoz page",
    voiceSamples: [],
    seed: 1
  };

  it("mounts without a topic and offers to write", () => {
    const out = html(<ArticleWriter {...base} />);
    expect(out).toContain("Write the full article");
  });

  it("explains why the button is disabled rather than just greying out", () => {
    // It used to sit greyed out with no explanation, which reads as broken rather
    // than as waiting for input.
    const out = html(<ArticleWriter {...base} />);
    expect(out).toContain("disabled");
    expect(out).toContain("Type a topic first");
  });

  it("drops the explanation once a topic is present", () => {
    const out = html(<ArticleWriter {...base} topic="Why engagement scores mislead" />);
    expect(out).not.toContain("Type a topic first");
  });

  it("hides the editor until there is an article to edit", () => {
    const out = html(<ArticleWriter {...base} topic="A topic" />);
    expect(out).not.toContain("Revise:");
    expect(out).not.toContain("Copy article");
  });

  it("stays disabled while the host is busy generating something else", () => {
    // Studio passes its own `loading`; two generations at once would strand one.
    const out = html(<ArticleWriter {...base} topic="A topic" busy />);
    expect(out).toContain("disabled");
  });

  it("renders no undo or stale notice on a first mount", () => {
    const out = html(<ArticleWriter {...base} topic="A topic" staleSignal={0} />);
    expect(out).not.toContain("Undo the");
    expect(out).not.toContain("Written for the previous version");
  });
});
