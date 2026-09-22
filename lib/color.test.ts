import { describe, it, expect } from "vitest";
import {
  alphaOf,
  hslToRgb,
  isTransparent,
  parseColor,
  rgbToHsl,
  svgPaint,
  toHex,
  toHslString,
  toRgbString,
  withAlpha,
  type Rgba
} from "./color";
import { sanitiseHtml } from "./slideElements";

// This module replaces four `<input type="color">` that each guarded with
// `/^#[0-9a-f]{6}$/i` and fell back to black. Every colour that was NOT six-digit hex —
// every `rgba()`, every `hsl()`, every `transparent` — displayed as black while being
// something else. So the assertions here are mostly about the cases those guards dropped.
//
// The two output invariants are load-bearing rather than tidy, and both are documented in
// the module header: no double quote may ever appear (sanitiseHtml truncates the style
// attribute at one, silently, and only the export notices), and one input must always
// produce one byte-identical string (normaliseSpans merges spans by comparing them).

const RGBA: Rgba = { r: 67, g: 175, b: 205, a: 0.5 };

describe("parseColor reads every dialect the app can hand it", () => {
  it("reads hex in both lengths, and in either case", () => {
    expect(parseColor("#0b1f33")).toEqual({ r: 11, g: 31, b: 51, a: 1 });
    expect(parseColor("#0B1F33")).toEqual({ r: 11, g: 31, b: 51, a: 1 });
    expect(parseColor("#abc")).toEqual({ r: 170, g: 187, b: 204, a: 1 });
  });

  it("reads the alpha out of eight- and four-digit hex", () => {
    // 0x80 is 128/255 — 0.502, not 0.5. Eight-bit alpha genuinely cannot hold a half.
    expect(parseColor("#43afcd80")?.a).toBe(0.502);
    expect(parseColor("#0000")?.a).toBe(0);
  });

  it("reads what getComputedStyle actually returns", () => {
    // This is the form every computed colour arrives in, which is why the old hex guard
    // meant a selected word's colour always showed as black.
    expect(parseColor("rgb(11, 31, 51)")).toEqual({ r: 11, g: 31, b: 51, a: 1 });
    expect(parseColor("rgba(67, 175, 205, 0.5)")).toEqual(RGBA);
  });

  it("reads modern space-and-slash syntax as well as the legacy commas", () => {
    expect(parseColor("rgb(11 31 51)")).toEqual({ r: 11, g: 31, b: 51, a: 1 });
    expect(parseColor("rgb(67 175 205 / 0.5)")).toEqual(RGBA);
    expect(parseColor("hsl(210 100% 40%)")).toEqual(parseColor("hsl(210, 100%, 40%)"));
  });

  it("reads percentage channels and percentage alpha", () => {
    expect(parseColor("rgb(100%, 0%, 0%)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor("rgba(255, 0, 0, 50%)")?.a).toBe(0.5);
  });

  it("reads hsl, including the deg suffix", () => {
    expect(parseColor("hsl(0, 100%, 50%)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor("hsl(120deg, 100%, 50%)")).toEqual({ r: 0, g: 255, b: 0, a: 1 });
  });

  it("knows transparent, which is what the app actually stores", () => {
    // lib/deckStore.ts defaults fill and stroke to it, and the highlight "None" button
    // writes it. Reading it as black-with-alpha-0 rather than as unparseable is the point.
    expect(parseColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("returns null rather than a silent black for something it cannot read", () => {
    // The whole reason this is not `=> Rgba`. A control handed a value it does not
    // understand must leave the old one alone, not recolour the text to black.
    expect(parseColor("not a colour")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
    expect(parseColor("rgb(1, 2)")).toBeNull();
    expect(parseColor("")).toBeNull();
    expect(parseColor(undefined as unknown as string)).toBeNull();
  });
});

describe("the formatters are canonical", () => {
  // normaliseSpans (lib/richText.ts) merges adjacent spans only when their style strings
  // are byte-identical. A formatter with two spellings of one value stops that merge
  // working, and spans then accumulate one per edit with nothing saying why.
  it("gives one input exactly one spelling, every time", () => {
    for (const css of ["#43afcd", "rgba(67, 175, 205, 0.5)", "hsl(210, 100%, 40%)", "transparent"]) {
      const a = parseColor(css)!;
      expect(toHex(a)).toBe(toHex(parseColor(css)!));
      expect(toRgbString(a)).toBe(toRgbString(parseColor(css)!));
      expect(toHslString(a)).toBe(toHslString(parseColor(css)!));
    }
  });

  it("writes alpha as a plain decimal, never as `.5` and never as float noise", () => {
    expect(toRgbString({ r: 1, g: 2, b: 3, a: 0.5 })).toBe("rgba(1, 2, 3, 0.5)");
    expect(toRgbString({ r: 1, g: 2, b: 3, a: 0.1 + 0.2 })).toBe("rgba(1, 2, 3, 0.3)");
    expect(toRgbString({ r: 1, g: 2, b: 3, a: 0 })).toBe("rgba(1, 2, 3, 0)");
  });

  it("drops the alpha channel entirely when the colour is opaque", () => {
    expect(toHex({ r: 11, g: 31, b: 51, a: 1 })).toBe("#0b1f33");
    expect(toRgbString({ r: 11, g: 31, b: 51, a: 1 })).toBe("rgb(11, 31, 51)");
    expect(toHslString({ r: 255, g: 0, b: 0, a: 1 })).toBe("hsl(0, 100%, 50%)");
  });

  it("clamps and rounds rather than emitting a broken value", () => {
    // The rule lib/richText.ts's rgbToHex already follows, kept here.
    expect(toHex({ r: 255.6, g: -4, b: 0, a: 1 })).toBe("#ff0000");
    expect(toHex({ r: NaN, g: 0, b: 0, a: 1 })).toBe("#000000");
    expect(toRgbString({ r: 0, g: 0, b: 0, a: 42 })).toBe("rgb(0, 0, 0)");
  });
});

describe("no formatter can ever emit a double quote", () => {
  // sanitiseHtml reads style="…" with a regex that stops at the delimiting quote, so a
  // stray `"` truncates the attribute. It does not throw: the styling works on screen and
  // is simply missing from the exported PNG. See lib/richText.ts's header.
  const samples = ["#0b1f33", "#43afcd80", "rgba(67, 175, 205, 0.5)", "hsl(210, 100%, 40%)", "transparent"];

  it("across every output, for every input", () => {
    for (const css of samples) {
      const c = parseColor(css)!;
      for (const out of [toHex(c), toRgbString(c), toHslString(c), withAlpha(css, 0.25), svgPaint(css).color]) {
        expect(out, `${css} produced ${out}`).not.toContain('"');
      }
    }
  });

  it("and the result survives the real sanitiser intact", () => {
    for (const css of samples) {
      const value = toRgbString(parseColor(css)!);
      const html = `<span style="color: ${value}">x</span>`;
      expect(sanitiseHtml(html), css).toBe(html);
    }
  });
});

describe("round trips", () => {
  it("hex survives parse → format → parse", () => {
    for (const hex of ["#000000", "#ffffff", "#0b1f33", "#43afcd", "#75a02f"]) {
      expect(toHex(parseColor(hex)!)).toBe(hex);
    }
  });

  it("alpha survives hex8 → rgba → hsla → hex8", () => {
    const start = "#43afcd80";
    const viaRgb = toRgbString(parseColor(start)!);
    const viaHsl = toHslString(parseColor(viaRgb)!);
    const end = parseColor(viaHsl)!;

    // Alpha is carried verbatim the whole way round — that is what this test is for.
    expect(end.a).toBe(parseColor(start)!.a);

    // The CHANNELS may move by one, and that is honest rather than a defect: toHslString
    // rounds hue to whole degrees and s/l to whole percent so the formatters stay
    // canonical, and 67 comes back as 66. Asserting byte equality here would be asserting
    // something the format cannot promise.
    const from = parseColor(start)!;
    for (const k of ["r", "g", "b"] as const) {
      expect(Math.abs(end[k] - from[k]), `${k} drifted too far`).toBeLessThanOrEqual(1);
    }
  });

  it("hsl survives format → parse → format", () => {
    // Not rgb → hsl → rgb: that direction genuinely loses precision to integer degrees.
    // This is the direction the picker actually uses, and it has to be stable.
    for (const hsl of ["hsl(0, 100%, 50%)", "hsl(210, 100%, 40%)", "hsl(120, 50%, 25%)"]) {
      expect(toHslString(parseColor(hsl)!)).toBe(hsl);
    }
  });

  it("treats hue 360 and hue 0 as one colour, not two", () => {
    expect(rgbToHsl(hslToRgb(360, 100, 50)).h).toBe(0);
  });

  it("holds grey at zero saturation instead of inventing a hue", () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128, a: 1 })).toEqual({ h: 0, s: 0, l: 50, a: 1 });
  });
});

describe("withAlpha", () => {
  it("keeps the alpha somebody chose rather than quantising it", () => {
    // Eight-digit hex would store 50% as 128/255 and read it back as 50.2%, so the number
    // under the cursor would drift while they dragged the slider.
    expect(withAlpha("#43afcd", 0.5)).toBe("rgba(67, 175, 205, 0.5)");
    expect(alphaOf(withAlpha("#43afcd", 0.5))).toBe(0.5);
  });

  it("goes back to plain hex once the colour is opaque again", () => {
    expect(withAlpha("rgba(67, 175, 205, 0.5)", 1)).toBe("#43afcd");
  });

  it("returns the input untouched when it cannot read it", () => {
    // A control must not be able to blank a value it merely failed to parse.
    expect(withAlpha("var(--something)", 0.5)).toBe("var(--something)");
  });
});

describe("isTransparent and alphaOf", () => {
  it("catches both spellings of invisible", () => {
    expect(isTransparent("transparent")).toBe(true);
    expect(isTransparent("rgba(0, 0, 0, 0)")).toBe(true);
    expect(isTransparent("#00000000")).toBe(true);
    expect(isTransparent("#000000")).toBe(false);
  });

  it("says opaque for anything unreadable rather than guessing", () => {
    expect(isTransparent("nonsense")).toBe(false);
    expect(alphaOf("nonsense")).toBe(1);
  });
});

describe("svgPaint", () => {
  // SVG takes the colour and the opacity as SEPARATE attributes. Eight-digit hex works in
  // current browsers but is not what the spec says, and this markup is re-parsed as XML and
  // rasterised — a place where "current browsers accept it" has already cost this project.
  it("splits alpha out into its own value", () => {
    expect(svgPaint("rgba(67, 175, 205, 0.5)")).toEqual({ color: "#43afcd", opacity: 0.5 });
    expect(svgPaint("#43afcd")).toEqual({ color: "#43afcd", opacity: 1 });
  });

  it("carries transparent through as zero opacity, not as a missing fill", () => {
    expect(svgPaint("transparent")).toEqual({ color: "#000000", opacity: 0 });
  });

  it("passes an unreadable value through untouched", () => {
    expect(svgPaint("url(#grad)")).toEqual({ color: "url(#grad)", opacity: 1 });
  });
});
