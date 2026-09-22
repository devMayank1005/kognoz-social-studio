import { describe, it, expect } from "vitest";
import { runStyleToCss, parseRunStyle, mergeRunStyle, sameRunStyle, normaliseSpans, rgbToHex, firstFamily, sameFamily } from "./richText";
import { sanitiseHtml } from "./slideElements";

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

  it("ignores declarations it does not own rather than choking on them", () => {
    // A gradient word from the template carries background-image and background-clip.
    const css = "background-image: linear-gradient(90deg, #43AFCD, #7BC67B); background-clip: text; color: transparent";
    expect(parseRunStyle(css)).toEqual({ color: "transparent" });
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
