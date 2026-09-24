import { describe, it, expect } from "vitest";
import {
  runStyleToCss,
  parseRunStyle,
  mergeRunStyle,
  sameRunStyle,
  normaliseSpans,
  rgbToHex,
  firstFamily,
  sameFamily,
  hasDecoration,
  toggleDecoration,
  gradientRun,
  isGradient,
  clearGradient,
  scriptRun,
  RUN_KEYS,
  familiesInHtml
} from "./richText";
import { sanitiseHtml, textOfHtml } from "./slideElements";

describe("runStyleToCss", () => {
  it("writes px on the size and leaves the rest alone", () => {
    expect(runStyleToCss({ fontSize: 48, fontWeight: 700, color: "#0B1F33" })).toBe(
      "font-size: 48px; font-weight: 700; color: #0B1F33"
    );
  });

  it("skips anything the patch does not actually say", () => {
    expect(runStyleToCss({ color: "#fff", fontFamily: undefined })).toBe("color: #fff");
    expect(runStyleToCss({})).toBe("");
  });

  it("keeps the declaration order stable so two identical runs are byte-identical", () => {
    // normaliseSpans merges adjacent spans by comparing their attribute strings, so the
    // same patch has to serialise the same way every time or the merge silently stops
    // working.
    const a = runStyleToCss({ color: "#fff", fontSize: 20 });
    const b = runStyleToCss({ fontSize: 20, color: "#fff" });
    expect(a).toBe(b);
  });
});

describe("the quote constraint", () => {
  // This is the one that bites. sanitiseHtml reads the style attribute with a regex that
  // stops at the delimiting quote, so a double quote inside the value truncates it — on
  // screen the styling survives (the browser already parsed it), in the export it is gone.
  it("never emits a double quote, even from a font stack that arrived with one", () => {
    const css = runStyleToCss({ fontFamily: '"Fraunces", serif' });
    expect(css).not.toContain('"');
    expect(css).toBe("font-family: 'Fraunces', serif");
  });

  it("survives the real sanitiser with the font stack intact", () => {
    const css = runStyleToCss({ fontFamily: "'Fraunces', serif", fontSize: 64, fontWeight: 600 });
    const clean = sanitiseHtml(`<span style="${css}">Culture</span>`);
    expect(clean).toContain("Fraunces");
    expect(clean).toContain("64px");
    expect(clean).toContain("600");
    expect(clean).toContain("Culture");
  });

  it("would lose the stack if the attribute were single quoted — proving why it is not", () => {
    // Not a test of our code so much as of the constraint our code exists to respect.
    const css = runStyleToCss({ fontFamily: "'Fraunces', serif", color: "#fff" });
    const clean = sanitiseHtml(`<span style='${css}'>Culture</span>`);
    expect(clean).not.toContain("#fff");
  });
});

describe("parseRunStyle", () => {
  it("round-trips what runStyleToCss writes", () => {
    const style = { fontFamily: "'Open Sans', sans-serif", fontSize: 32, fontWeight: 400, color: "#43AFCD" };
    expect(parseRunStyle(runStyleToCss(style))).toEqual(style);
  });

  it("now reads the template's gradient word, because the toolbar owns gradients too", () => {
    // This used to assert the opposite. It changed on purpose: once "apply a gradient to
    // this selection" is a control, the three declarations that make one are ours to read.
    const css = "background-image: linear-gradient(90deg, #43AFCD, #7BC67B); background-clip: text; color: transparent";
    expect(parseRunStyle(css)).toEqual({
      backgroundImage: "linear-gradient(90deg, #43AFCD, #7BC67B)",
      backgroundClip: "text",
      color: "transparent"
    });
  });

  it("still ignores declarations outside RUN_KEYS rather than choking", () => {
    expect(parseRunStyle("position: absolute; float: left; color: #fff")).toEqual({ color: "#fff" });
  });

  it("returns nothing for junk", () => {
    expect(parseRunStyle("")).toEqual({});
    expect(parseRunStyle("not-a-declaration")).toEqual({});
    expect(parseRunStyle("font-size:")).toEqual({});
  });
});

describe("mergeRunStyle", () => {
  it("lets the patch win where it says something", () => {
    expect(mergeRunStyle({ color: "#000", fontSize: 20 }, { color: "#fff" })).toEqual({
      color: "#fff",
      fontSize: 20
    });
  });

  it("does not let an empty patch erase the base", () => {
    expect(mergeRunStyle({ color: "#000" }, {})).toEqual({ color: "#000" });
    expect(mergeRunStyle({ color: "#000" }, { color: "" })).toEqual({ color: "#000" });
  });
});

describe("sameRunStyle", () => {
  it("compares only the four run keys", () => {
    expect(sameRunStyle({ color: "#fff" }, { color: "#fff" })).toBe(true);
    expect(sameRunStyle({ color: "#fff" }, { color: "#000" })).toBe(false);
    expect(sameRunStyle({}, {})).toBe(true);
  });
});

describe("normaliseSpans", () => {
  it("drops spans with nothing in them", () => {
    expect(normaliseSpans('a<span style="color: #fff"></span>b')).toBe("ab");
  });

  it("merges two adjacent spans that say the same thing", () => {
    const html = '<span style="color: #fff">Cul</span><span style="color: #fff">ture</span>';
    expect(normaliseSpans(html)).toBe('<span style="color: #fff">Culture</span>');
  });

  it("merges a whole run of them, not just the first pair", () => {
    const one = '<span style="color: #fff">a</span>';
    expect(normaliseSpans(one + one + one)).toBe('<span style="color: #fff">aaa</span>');
  });

  it("leaves adjacent spans alone when they differ", () => {
    const html = '<span style="color: #fff">a</span><span style="color: #000">b</span>';
    expect(normaliseSpans(html)).toBe(html);
  });

  it("leaves NESTING alone — the inner span is a narrower range, not a duplicate", () => {
    const html = '<span style="color: #fff"><span style="font-weight: 700">a</span>b</span>';
    expect(normaliseSpans(html)).toBe(html);
  });

  it("collapses a span whose only child says exactly the same thing", () => {
    // Observed in the running app: pressing the same swatch twice on a range the browser
    // had already wrapped produced this. It renders correctly and grows a layer each time.
    const html = '<span style="color: #B52879"><span style="color: #B52879">Culture</span></span>';
    expect(normaliseSpans(html)).toBe('<span style="color: #B52879">Culture</span>');
  });

  it("collapses a whole stack of identical wrappers, not just one layer", () => {
    const html =
      '<span style="color: #fff"><span style="color: #fff"><span style="color: #fff">a</span></span></span>';
    expect(normaliseSpans(html)).toBe('<span style="color: #fff">a</span>');
  });

  it("does not collapse an identical-looking wrapper that has other content beside it", () => {
    // Here the inner span really is a narrower range; merging would restyle the "b".
    const html = '<span style="color: #fff"><span style="color: #fff">a</span>b</span>';
    expect(normaliseSpans(html)).toBe(html);
  });

  it("leaves the template's gradient word untouched", () => {
    const html =
      'Culture is what your people <span style="background-image: linear-gradient(90deg,#43AFCD,#7BC67B); background-clip: text; color: transparent">do</span>';
    expect(normaliseSpans(html)).toBe(html);
  });

  it("is idempotent", () => {
    const html = '<span style="color: #fff">a</span><span style="color: #fff">b</span><span></span>';
    const once = normaliseSpans(html);
    expect(normaliseSpans(once)).toBe(once);
  });

  it("survives empty input", () => {
    expect(normaliseSpans("")).toBe("");
  });

  it("never merges block spans — each one is a separate line from renderLines", () => {
    // renderLines gives lines 2..N byte-identical styles. Merging them joined the lines on
    // every blur: "A / B / C" was stored as "A / BC".
    const line1 = '<span style="display: block; margin-top: 0px;">A</span>';
    const rest = (t: string) => `<span style="display: block; margin-top: 0.55em;">${t}</span>`;
    const html = line1 + rest("B") + rest("C");
    const out = normaliseSpans(sanitiseHtml(html));
    expect(out.match(/display:\s*block/g)).toHaveLength(3);
    expect(textOfHtml(out).split("\n").filter(Boolean)).toEqual(["A", "B", "C"]);
  });

  it("does not collapse a block span wrapping an identical block span", () => {
    const html = '<span style="display: block"><span style="display: block">a</span></span>';
    expect(normaliseSpans(html)).toBe(html);
  });
});

describe("rgbToHex", () => {
  it("converts what getComputedStyle actually returns", () => {
    expect(rgbToHex("rgb(11, 31, 51)")).toBe("#0b1f33");
    expect(rgbToHex("rgba(67, 175, 205, 0.5)")).toBe("#43afcd");
  });

  it("clamps and rounds rather than emitting a broken hex", () => {
    expect(rgbToHex("rgb(255.6, -4, 0)")).toBe("#ff0000");
  });

  it("passes through anything that is not an rgb triple", () => {
    // A hex we wrote ourselves, or a keyword the template used.
    expect(rgbToHex("#0B1F33")).toBe("#0B1F33");
    expect(rgbToHex("transparent")).toBe("transparent");
  });
});

describe("firstFamily / sameFamily", () => {
  it("matches a picker option against what the browser computed", () => {
    // The browser re-serialises the stack, so string equality is not the question being asked.
    expect(sameFamily("'Fraunces', serif", '"Fraunces", Georgia, serif')).toBe(true);
    expect(sameFamily("'Open Sans', sans-serif", "'Fraunces', serif")).toBe(false);
  });

  it("is case and whitespace insensitive", () => {
    expect(firstFamily('  "Plus Jakarta Sans" , sans-serif')).toBe("plus jakarta sans");
  });

  it("says no rather than yes when either side is missing", () => {
    expect(sameFamily(undefined, "'Fraunces', serif")).toBe(false);
    expect(sameFamily("", "")).toBe(false);
  });
});

describe("the extended vocabulary", () => {
  it("writes px only where px is meant", () => {
    expect(runStyleToCss({ fontSize: 40, letterSpacing: -2, opacity: 0.5, fontWeight: 700 })).toBe(
      "font-size: 40px; font-weight: 700; letter-spacing: -2px; opacity: 0.5"
    );
  });

  it("round-trips every key it can write", () => {
    const full = {
      fontFamily: "'Inter', sans-serif",
      fontSize: 32,
      fontWeight: 600,
      fontStyle: "italic" as const,
      color: "#0B1F33",
      backgroundColor: "#FFE9A8",
      textDecorationLine: "underline line-through",
      textTransform: "uppercase" as const,
      letterSpacing: 1.5,
      opacity: 0.8,
      verticalAlign: "super" as const,
      textShadow: "0 2px 6px rgba(0,0,0,0.35)",
      webkitTextStroke: "2px #000",
      backgroundImage: "linear-gradient(90deg, #A, #B)",
      backgroundClip: "text",
      direction: "rtl" as const
    };
    expect(parseRunStyle(runStyleToCss(full))).toEqual(full);
  });

  it("survives the real sanitiser with every property intact", () => {
    // The whole vocabulary has to fit inside a double-quoted style attribute, and
    // sanitiseHtml rejects any style containing url(, <, > or a double quote.
    const css = runStyleToCss({
      fontFamily: "'Playfair Display', serif",
      textShadow: "0 2px 6px rgba(0,0,0,0.35)",
      webkitTextStroke: "2px #000",
      backgroundImage: "linear-gradient(90deg, #43AFCD 0%, #7BC67B 100%)",
      backgroundClip: "text"
    });
    const clean = sanitiseHtml(`<span style="${css}">x</span>`);
    expect(clean).toContain("Playfair Display");
    expect(clean).toContain("-webkit-text-stroke");
    expect(clean).toContain("linear-gradient");
    expect(clean).toContain("background-clip: text");
  });

  it("keeps RUN_KEYS and CSS names in step", () => {
    // Every key must serialise to something; a key with no CSS name would vanish silently.
    for (const key of RUN_KEYS) {
      const css = runStyleToCss({ [key]: key === "fontSize" || key === "letterSpacing" || key === "opacity" || key === "fontWeight" ? 1 : "x" });
      expect(css.length, key).toBeGreaterThan(0);
    }
  });
});

describe("decoration toggles", () => {
  it("adds one without disturbing the others", () => {
    expect(toggleDecoration({ textDecorationLine: "underline" }, "line-through")).toBe("underline line-through");
  });

  it("removes one without disturbing the others", () => {
    expect(toggleDecoration({ textDecorationLine: "underline line-through" }, "underline")).toBe("line-through");
  });

  it("says 'none' rather than empty when the last one goes", () => {
    // An empty value is skipped by runStyleToCss, so the span would keep inheriting the
    // decoration and the button would look broken.
    expect(toggleDecoration({ textDecorationLine: "underline" }, "underline")).toBe("none");
  });

  it("starts from nothing", () => {
    expect(toggleDecoration({}, "overline")).toBe("overline");
    expect(toggleDecoration({ textDecorationLine: "none" }, "overline")).toBe("overline");
  });

  it("reads back what it wrote", () => {
    const style = { textDecorationLine: toggleDecoration({}, "underline") };
    expect(hasDecoration(style, "underline")).toBe(true);
    expect(hasDecoration(style, "overline")).toBe(false);
    expect(hasDecoration({}, "underline")).toBe(false);
  });
});

describe("gradient text", () => {
  it("is the four declarations that only work together", () => {
    const g = gradientRun("linear-gradient(90deg, #A, #B)");
    expect(g).toEqual({
      backgroundImage: "linear-gradient(90deg, #A, #B)",
      webkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent"
    });
    expect(isGradient(g)).toBe(true);
  });

  it("writes BOTH spellings of the clip, as the template does", () => {
    // components/Slide.tsx:28 sets WebkitBackgroundClip and backgroundClip together for the
    // template's own gradient word. A range gradient that emitted only the unprefixed one
    // rendered as a solid transparent block anywhere the prefix is still needed — including
    // whatever rasterises the exported SVG. This was shipped, and this test is why it is not
    // shipped again.
    const css = runStyleToCss(gradientRun("linear-gradient(90deg, #A, #B)"));
    expect(css).toContain("-webkit-background-clip: text");
    expect(css).toContain("; background-clip: text");
  });

  it("puts background-image before either clip, which is what makes it work", () => {
    // `background` shorthand resets background-clip; this uses the longhand, and the order
    // in RUN_KEYS is what guarantees it. Matching on the leading space distinguishes
    // `background-clip` from the tail of `-webkit-background-clip`, which contains it.
    const css = runStyleToCss(gradientRun("linear-gradient(90deg, #A, #B)"));
    expect(css.indexOf("background-image")).toBeLessThan(css.indexOf("-webkit-background-clip"));
    expect(css.indexOf("-webkit-background-clip")).toBeLessThan(css.indexOf("; background-clip"));
  });

  it("clears back to a real colour rather than leaving transparent text", () => {
    const off = clearGradient("#0B1F33");
    expect(isGradient(off)).toBe(false);
    expect(off.color).toBe("#0B1F33");
    // Both spellings have to be reset too, or the clip survives the colour that replaced it.
    expect(off.webkitBackgroundClip).toBe("border-box");
    expect(off.backgroundClip).toBe("border-box");
  });
});

describe("super and subscript", () => {
  it("shifts the baseline AND shrinks, which is what makes it read as a script", () => {
    expect(scriptRun("super", 40)).toEqual({ verticalAlign: "super", fontSize: 26 });
    expect(scriptRun("sub", 40)).toEqual({ verticalAlign: "sub", fontSize: 26 });
  });

  it("restores the base size on the way back", () => {
    expect(scriptRun("baseline", 40)).toEqual({ verticalAlign: "baseline", fontSize: 40 });
  });

  it("never shrinks to zero", () => {
    expect(scriptRun("super", 1).fontSize).toBeGreaterThan(0);
  });
});

describe("familiesInHtml", () => {
  // The guard for a silent export failure: a font applied to a SELECTION lives only inside
  // the element's markup, so an exporter that asks the element alone embeds nothing for it
  // and that word comes back from the rasteriser in a system fallback.
  it("finds a family applied to a range", () => {
    expect(familiesInHtml(`<span style="font-family: 'Playfair Display', serif">Culture</span> is`)).toEqual([
      "'Playfair Display', serif"
    ]);
  });

  it("finds several, de-duplicated", () => {
    const html =
      `<span style="font-family: 'Lora', serif">a</span>` +
      `<span style="font-family: 'Inter', sans-serif">b</span>` +
      `<span style="font-family: 'Lora', serif">c</span>`;
    expect(familiesInHtml(html).sort()).toEqual(["'Inter', sans-serif", "'Lora', serif"]);
  });

  it("is not confused by other declarations around it", () => {
    const html = `<span style="font-weight: 700; font-family: 'Inter', sans-serif; color: #fff">x</span>`;
    expect(familiesInHtml(html)).toEqual(["'Inter', sans-serif"]);
  });

  it("returns nothing for markup that names no family", () => {
    expect(familiesInHtml(`<span style="color: #fff">x</span>`)).toEqual([]);
    expect(familiesInHtml("plain text")).toEqual([]);
    expect(familiesInHtml("")).toEqual([]);
  });
});
