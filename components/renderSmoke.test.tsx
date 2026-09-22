import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Slide, type SlideKind } from "./Slide";
import { Logo } from "./Logo";
import { MarketScanPanel } from "./calendar/MarketScanPanel";
import { SocialPreview } from "./SocialPreview";
import { FORMATS, STUDIO_FORMATS, type FormatId } from "@/lib/formats";
import { BRANDS, KOGNOZ, KONVERZ, type Brand } from "@/lib/brands";
import { coerceProblems, type MarketScan } from "@/lib/marketScan";
import type { DesignSetId } from "@/lib/designSets";
import type { CoercedSlide } from "@/lib/coerce";

// ---------------------------------------------------------------------------
// Does every component actually render?
//
// Nothing checked this. The type checker proves the props line up and the unit
// tests prove the pure functions are right, and between those two a renderer can
// still throw on a body with no line breaks, or quietly drop half a brand's
// identity, and ship.
//
// Both of those have now happened here. The gradient word rendered as a solid
// rectangle for a whole branch because `background` is a shorthand that resets
// `background-clip` — caught by looking at a picture, not by a test. And six
// renderers hand-rolled their own footer or eyebrow instead of using the shared
// helpers, so four of fifteen formats silently dropped "Empowered by Kognoz" and
// two dropped the sparkle. Nothing failed. The decks just came out wrong.
//
// renderToStaticMarkup needs no DOM and no new dependency, and it catches
// exactly the class above: crashes, empty output, and missing chrome.
//
// WHAT IT CANNOT SEE, so that nobody reads a green run as more than it is: no
// effects, no event handlers, no layout, no hydration. A click that does nothing
// and two elements overlapping both pass this file. Those need a browser.
// ---------------------------------------------------------------------------

const SLIDES: CoercedSlide[] = [
  { title: "The pile is the bottleneck", body: "Screening now takes two minutes.\nA recruiter still decides." },
  { title: "One profile, not five tools", body: "Behaviour, domain and technical fit arrive together." },
  { title: "60%", body: "Less time to hire" },
  { title: "The turn", body: "What a leader does on Monday." }
];

function renderSlide(
  brand: Brand,
  format: FormatId,
  kind: SlideKind,
  over: Partial<React.ComponentProps<typeof Slide>> = {}
): string {
  const spec = FORMATS[format];
  return renderToStaticMarkup(
    <Slide
      brand={brand}
      kind={kind}
      data={SLIDES[0]}
      accent={Object.values(brand.pillars)[0]}
      eyebrow={Object.keys(brand.pillars)[0]}
      cta="Book a demo on your own roles"
      baseW={spec.w}
      baseH={spec.h}
      idx={1}
      total={6}
      id="smoke"
      cover="Screening to *selection in one flow*"
      slides={SLIDES}
      seed={0}
      images={{}}
      setImg={() => {}}
      design={{ set: brand.defaultSet, url: brand.url }}
      ideaMode={!!spec.idea}
      {...over}
    />
  );
}

/** Every (format, kind) pair the Studio can actually put on screen. */
const CASES: Array<{ format: FormatId; kind: SlideKind }> = STUDIO_FORMATS.flatMap((format) => {
  const spec = FORMATS[format];
  if (spec.single) return [{ format, kind: spec.single as SlideKind }];
  return (["cover", "content", "end"] as SlideKind[]).map((kind) => ({ format, kind }));
});

describe("every slide renders, for both brands, in every design set", () => {
  for (const [brandId, brand] of Object.entries(BRANDS)) {
    const sets = Object.keys(brand.designSets) as DesignSetId[];

    it(`${brandId}: ${CASES.length} format/kind pairs x ${sets.length} sets`, () => {
      for (const { format, kind } of CASES) {
        for (const set of sets) {
          for (const seed of [0, 3]) {
            let html = "";
            expect(
              () => (html = renderSlide(brand, format, kind, { design: { set, url: brand.url }, seed })),
              `${brandId} / ${format} / ${kind} / ${set} / seed ${seed} threw`
            ).not.toThrow();

            // A renderer that returns an empty box passes "does not throw" and
            // fails a person. The `video` kind is genuinely sparse, so the floor
            // is set where an empty card still fails.
            expect(html.length, `${brandId} / ${format} / ${kind} / ${set} rendered almost nothing`).toBeGreaterThan(400);
          }
        }
      }
    });
  }

  it("renders with the photo slot switched on, where a format offers one", () => {
    for (const brand of Object.values(BRANDS)) {
      for (const { format, kind } of CASES) {
        expect(() => renderSlide(brand, format, kind, { photoOn: true }), `${brand.id} / ${format} photoOn`).not.toThrow();
      }
    }
  });
});

// The actual regression this file was written for.
describe("brand chrome reaches every format", () => {
  const SPARKLE = "✦";
  const PARENT = "Empowered by Kognoz";

  it("Konverz shows its sparkle and its parent line on all fifteen formats", () => {
    const missingSparkle: string[] = [];
    const missingParent: string[] = [];

    // Across every design set, not just the default one. The sets choose which
    // content variant draws, and a variant that hand-rolls its eyebrow only
    // appears under the set that selects it — the photo-glass magazine slide is
    // exactly that, and the default set never reaches it.
    for (const { format, kind } of CASES) {
      for (const set of Object.keys(KONVERZ.designSets) as DesignSetId[]) {
        for (const seed of [0, 1, 2]) {
          const where = `${format}/${kind}/${set}`;
          const html = renderSlide(KONVERZ, format, kind, { design: { set, url: KONVERZ.url }, seed });
          // `end` is the closing card and carries the logo without an eyebrow, so
          // it is exempt from the sparkle and from nothing else.
          if (kind !== "end" && !html.includes(SPARKLE) && !missingSparkle.includes(where)) missingSparkle.push(where);
          if (!html.includes(PARENT) && !missingParent.includes(where)) missingParent.push(where);
        }
      }
    }

    // Reported together, not one assertion after the other: the first failure
    // would otherwise hide the second, and the whole point of this test is
    // seeing the full list of renderers that skipped the chrome.
    expect({ missingSparkle, missingParent }).toEqual({ missingSparkle: [], missingParent: [] });
  });

  // The other half: chrome that belongs to one brand must not leak into the other.
  it("Kognoz shows neither, on any format", () => {
    for (const { format, kind } of CASES) {
      const html = renderSlide(KOGNOZ, format, kind);
      expect(html.includes(SPARKLE), `${format}/${kind} drew Konverz's sparkle under Kognoz`).toBe(false);
      expect(html.includes(PARENT), `${format}/${kind} drew the parent line under Kognoz`).toBe(false);
    }
  });

  it("each brand draws its own wordmark, and its own website line where one is shown", () => {
    // The cover's bottom-right is the swipe cue by default, so the website line
    // is asserted on a content slide configured to show it.
    for (const brand of Object.values(BRANDS)) {
      expect(renderSlide(brand, "Carousel", "cover")).toContain(brand.logos.color.slice(0, 60));
      const withUrl = renderSlide(brand, "Carousel", "content", {
        design: { set: brand.defaultSet, url: brand.url, contentRight: "url" }
      });
      expect(withUrl, `${brand.id} did not draw its own url`).toContain(brand.url);
    }
  });

  // Legibility, not just correctness. A gradient that ends in the colour the page
  // is painted in applies its clip perfectly and renders an invisible word — which
  // is what Konverz's did on every boardroom slide until someone looked at one.
  it("the gradient word never ends in the colour the dark page is painted in", () => {
    for (const brand of Object.values(BRANDS)) {
      const stops = (g: string) => (g.match(/#[0-9a-f]{6}/gi) ?? []).map((h) => h.toLowerCase());
      const onDark = new Set(stops(brand.GRAD_ON_DARK));
      const ground = stops(brand.GRAD_DARK);
      const clash = ground.filter((c) => onDark.has(c));
      expect(clash, `${brand.id}: ${clash.join(", ")} is both a gradient stop and a dark-page stop`).toEqual([]);
    }
  });

  it("a dark slide uses the dark ramp and a light slide uses the brand one", () => {
    const dark = renderSlide(KONVERZ, "Carousel", "cover", { design: { set: "dark", url: KONVERZ.url } });
    expect(dark).toContain(KONVERZ.GRAD_ON_DARK);
    const light = renderSlide(KONVERZ, "Carousel", "cover", { design: { set: "halo", url: KONVERZ.url } });
    expect(light).toContain(KONVERZ.GRAD);
  });

  // The defect that shipped last time and was invisible to every other test.
  it("the gradient word is clipped to the text, not painted as a block", () => {
    for (const brand of Object.values(BRANDS)) {
      const html = renderSlide(brand, "Carousel", "cover");
      const em = html.match(/style="[^"]*background-clip:text[^"]*"/);
      expect(em, `${brand.id} cover has no gradient-clipped word`).toBeTruthy();
      // `background` is a shorthand and resets background-clip, so it has to come
      // FIRST in the declaration order React emits.
      const decl = em![0];
      expect(decl.indexOf("background:"), `${brand.id}: background shorthand written after the clip, which cancels it`).toBeLessThan(
        decl.indexOf("background-clip")
      );
    }
  });
});

describe("the shapes that usually go untested", () => {
  const brand = KONVERZ;

  it("survives empty copy everywhere", () => {
    expect(() =>
      renderSlide(brand, "Carousel", "content", {
        cover: "",
        cta: "",
        eyebrow: "",
        data: { title: "", body: "" },
        slides: [{ title: "", body: "" }]
      })
    ).not.toThrow();
  });

  it("survives a single-slide deck on renderers that index further", () => {
    // Says vs Does reads slides[1], Numbers Wall slides[0..3], Journey Map three
    // columns. A short deck must render, not throw on an undefined.
    for (const format of ["Says vs Does", "Numbers Wall", "Journey Map", "Feature Card", "Montage"] as FormatId[]) {
      const kind = FORMATS[format].single as SlideKind;
      expect(() => renderSlide(brand, format, kind, { slides: [SLIDES[0]] }), `${format} with one slide`).not.toThrow();
      expect(() => renderSlide(brand, format, kind, { slides: [] }), `${format} with no slides`).not.toThrow();
    }
  });

  it("survives a body with no line breaks where the renderer splits on them", () => {
    // The chip cloud and the journey columns treat line breaks as layout.
    for (const [format, kind] of [
      ["Carousel", "content"],
      ["Journey Map", "journey"]
    ] as Array<[FormatId, SlideKind]>) {
      const html = renderSlide(brand, format, kind, {
        design: { set: "halo", url: brand.url },
        data: { title: "One line", body: "A single sentence with no breaks in it at all." },
        slides: [{ title: "Stage", body: "A single sentence with no breaks in it at all." }]
      });
      expect(html.length).toBeGreaterThan(400);
    }
  });

  it("survives copy far longer than any budget", () => {
    const long = "A sentence that keeps going. ".repeat(60);
    expect(() => renderSlide(brand, "Story", "story", { cover: long, data: { title: long, body: long } })).not.toThrow();
  });

  it("survives a design set belonging to the other brand", () => {
    // A saved design can outlive a brand switch. setSpec falls back rather than
    // throwing, and this is the assertion that says so.
    expect(() => renderSlide(KONVERZ, "Carousel", "content", { design: { set: "bloom", url: KONVERZ.url } })).not.toThrow();
    expect(() => renderSlide(KOGNOZ, "Carousel", "content", { design: { set: "halo", url: KOGNOZ.url } })).not.toThrow();
  });

  it("survives an undefined image map and a missing setter", () => {
    expect(() => renderSlide(brand, "Feature Card", "feature", { images: undefined, setImg: undefined, photoOn: true })).not.toThrow();
  });
});

describe("the panels render in every state they can hold", () => {
  const problems = coerceProblems(
    [
      {
        problem: "Panels re-interview the same shortlisted candidate because nobody trusts the first scorecard",
        who: "TA head, BFSI",
        evidence: "Median 3.2 interviews per shortlisted candidate",
        source: "Example Report, 2026",
        lane: "hire"
      },
      {
        problem: "Succession lists name people no manager has assessed in the last two years",
        who: "CHRO, conglomerate",
        evidence: "62% had no assessment on file",
        source: "",
        lane: "nurture"
      }
    ],
    Object.keys(KONVERZ.lanes)
  );

  const scanAt = (daysAgo: number): MarketScan => ({
    brandId: "konverz",
    scannedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    problems
  });

  const panel = (scan: MarketScan | null, busy = false, note = "") =>
    renderToStaticMarkup(
      <MarketScanPanel
        scan={scan}
        busy={busy}
        note={note}
        brandName={KONVERZ.name}
        onScan={() => {}}
        onRemove={() => {}}
        onEdit={() => {}}
        defaultOpen
      />
    );

  it("renders empty, fresh, stale, busy and noted", () => {
    expect(panel(null)).toContain("No market scan yet");
    expect(panel(scanAt(1))).toContain("Market scan");
    expect(panel(scanAt(90))).toContain("days old");
    expect(panel(scanAt(1), true)).toContain("Searching");
    expect(panel(scanAt(1), false, "Found 2 new problems.")).toContain("Found 2 new problems.");
  });

  it("says which problems have no source rather than styling them like the rest", () => {
    // An unsourced finding is the one most likely to have been assumed. Hiding
    // that is worse than not finding it.
    expect(panel(scanAt(1))).toContain("No source found");
  });

  it("does not call a scan with no date fresh", () => {
    const undated = { brandId: "konverz" as const, scannedAt: "", problems };
    expect(() => panel(undated)).not.toThrow();
  });

  // The panel whose whole job is showing what will be published, and which
  // previewed the wrong company for an entire branch.
  it("the social preview shows the loaded brand, never the other one", () => {
    for (const brand of Object.values(BRANDS)) {
      const html = renderToStaticMarkup(
        <SocialPreview
          isOpen
          onClose={() => {}}
          formatLabel="Carousel"
          baseW={1080}
          baseH={1350}
          pages={[{ kind: "cover", data: SLIDES[0], idx: 0, scale: 1, photoOn: false }]}
          shared={{
            brand,
            accent: Object.values(brand.pillars)[0],
            eyebrow: Object.keys(brand.pillars)[0],
            cta: "Book a demo",
            baseW: 1080,
            baseH: 1350,
            total: 3,
            cover: "Screening to *selection in one flow*",
            slides: SLIDES,
            seed: 0,
            images: {},
            setImg: () => {},
            design: { set: brand.defaultSet, url: brand.url }
          }}
          caption="A caption."
          onCaptionChange={() => {}}
          authorName="Someone"
          authorEmail="someone@example.com"
        />
      );

      // The byline in the platform mock.
      expect(html, `${brand.id} preview byline`).toContain(brand.name);
      // And the artwork inside it: `shared` feeds a real <Slide>, so a missing
      // brand there renders the whole deck in the other brand's identity.
      expect(html, `${brand.id} preview artwork`).toContain(brand.logos.color.slice(0, 60));

      const other = brand.id === "kognoz" ? KONVERZ : KOGNOZ;
      expect(html.includes(other.logos.color.slice(0, 60)), `${brand.id} preview drew ${other.id}'s wordmark`).toBe(false);
    }
  });

  it("the logo renders for both brands, at its own aspect ratio", () => {
    for (const brand of Object.values(BRANDS)) {
      const html = renderToStaticMarkup(<Logo h={64} brand={brand} />);
      expect(html).toContain(`width:${Math.round(64 * brand.logos.aspect)}px`);
      expect(html).toContain(`alt="${brand.name}"`);
    }
    // White-on-dark uses the white asset, not a CSS filter over the colour one.
    expect(renderToStaticMarkup(<Logo h={64} white brand={KONVERZ} />)).toContain(KONVERZ.logos.white.slice(0, 60));
  });
});

describe("Journey Map columns are sized to the page", () => {
  // THE BUG THIS GUARDS, and it shipped.
  //
  // The stage title and the capability chips used sz(), which is a constant times
  // the per-slide text scale, so they never reacted to how much text arrived. The
  // page is a fixed 1080x1350 with a footer under the columns and overflow:hidden
  // at the edge, so nothing below them can move. A long stage — or the A+ stepper
  // at its 150% ceiling — pushed the chips out through the bottom of their own
  // tint, across the logo, and off the slide.
  //
  // Measured in a browser at the time of the fix: the worst realistic case ran
  // 506px past the space it had. These assertions are the part of that a string
  // can hold; the geometry itself needs a browser, which is what the file header
  // says about every layout question here.

  const chipPx = (html: string): number[] =>
    [...html.matchAll(/font-size:(\d+)px;font-weight:500/g)].map((m) => Number(m[1]));

  const journey = (brand: Brand, slides: CoercedSlide[], scale = 1) =>
    renderSlide(brand, "Journey Map", "journey", { slides, scale, cover: "Screening to *selection*" });

  const SHORT: CoercedSlide[] = [
    { title: "Screen", body: "Screen AI\nProfile\nScorecards" },
    { title: "Interview", body: "Interview AI\nTech AI\nTranscripts" },
    { title: "Decide", body: "Reports\nBenchmarks\nAudit trail" }
  ];
  const CROWDED: CoercedSlide[] = [1, 2, 3].map((n) => ({
    title: `Stage number ${n} written long`,
    body: Array.from({ length: 8 }, (_, i) => `Capability line ${i + 1} that runs a good deal longer`).join("\n")
  }));

  it("leaves a comfortable column at its natural size", () => {
    for (const brand of Object.values(BRANDS)) {
      const sizes = chipPx(journey(brand, SHORT));
      expect(sizes.length, `${brand.id} rendered no chips`).toBeGreaterThan(0);
      expect(new Set(sizes), `${brand.id} should not shrink a short journey`).toEqual(new Set([19]));
    }
  });

  it("steps the type down when a stage carries more than fits", () => {
    for (const brand of Object.values(BRANDS)) {
      const crowded = Math.max(...chipPx(journey(brand, CROWDED)));
      expect(crowded, `${brand.id} did not shrink a crowded journey`).toBeLessThan(19);
    }
  });

  it("still honours the A+ stepper when there is room for it", () => {
    // The fix must not turn the per-slide text control into a no-op: it enlarges
    // when the column can take it, and is overruled only when it cannot.
    expect(Math.max(...chipPx(journey(KOGNOZ, SHORT, 1.5)))).toBeGreaterThan(19);
  });

  it("overrules the A+ stepper rather than letting it push text off the slide", () => {
    // sz() multiplied AFTER every other guard, so 150% on a full column was the
    // shortest path to the overflow this whole block exists to stop.
    expect(Math.max(...chipPx(journey(KOGNOZ, CROWDED, 1.5)))).toBeLessThan(Math.round(19 * 1.5));
  });

  it("sizes both brands from the same estimate, so neither is tuned away", () => {
    // Konverz's UI font is materially wider than Kognoz's — measured 1.05 advance
    // widths per character against 0.55 — and one constant covers both by taking
    // the wider. A journey that fits for one brand must fit for the other.
    const k = Math.max(...chipPx(journey(KOGNOZ, CROWDED)));
    const z = Math.max(...chipPx(journey(KONVERZ, CROWDED)));
    expect(Math.abs(k - z), "the two brands diverged").toBeLessThanOrEqual(1);
  });

  it("lets a long capability break rather than spill out of its chip", () => {
    const html = journey(KOGNOZ, [{ title: "Stage", body: "supercalifragilisticexpialidocious-capability" }]);
    expect(html).toContain("overflow-wrap:break-word");
  });
});
