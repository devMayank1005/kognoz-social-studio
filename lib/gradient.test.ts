import { describe, it, expect } from "vitest";
import {
  MAX_STOPS,
  defaultGradient,
  gradientCss,
  isDrawableGradient,
  normaliseGradient,
  parseGradientCss,
  svgGradientCoords,
  type Gradient
} from "./gradient";
import { sanitiseHtml } from "./slideElements";
import { GRAD, KONVERZ_GRAD, GRAD_DARK } from "./tokens";

// Gradients are stored as a structure and serialised on the way out, because the storage
// layer truncates colour strings at 64 characters without saying so and a four-stop gradient
// is 75. The tests below are mostly about the two things that silently break:
// the truncation (guarded by keeping CSS out of storage), and the byte-identity
// normaliseSpans depends on to merge spans.

const two: Gradient = {
  type: "linear",
  angle: 90,
  stops: [
    { color: "#43afcd", at: 0 },
    { color: "#75a02f", at: 100 }
  ]
};

describe("gradientCss is canonical", () => {
  it("gives the same gradient the same bytes, every time", () => {
    // normaliseSpans merges adjacent spans only when their style strings match byte for
    // byte. Two spellings of one gradient means the merge stops working and a span
    // accumulates on every edit.
    expect(gradientCss(two)).toBe(gradientCss({ ...two, stops: [...two.stops] }));
  });

  it("writes positions explicitly even when the input left them implied", () => {
    expect(gradientCss(two)).toBe("linear-gradient(90deg, #43afcd 0%, #75a02f 100%)");
  });

  it("re-serialises stop colours so one colour has one spelling", () => {
    // `#ABC` today and `rgb(170, 187, 204)` tomorrow are the same colour and must produce
    // the same bytes, or the merge above breaks on a difference nobody can see.
    const a = gradientCss({ ...two, stops: [{ color: "#ABC", at: 0 }, { color: "#75A02F", at: 100 }] });
    const b = gradientCss({ ...two, stops: [{ color: "rgb(170, 187, 204)", at: 0 }, { color: "#75a02f", at: 100 }] });
    expect(a).toBe(b);
  });

  it("keeps alpha on a stop", () => {
    const css = gradientCss({ ...two, stops: [{ color: "rgba(0, 0, 0, 0.5)", at: 0 }, { color: "#fff", at: 100 }] });
    expect(css).toContain("rgba(0, 0, 0, 0.5)");
  });

  it("writes a radial without an angle, because CSS radial has none", () => {
    expect(gradientCss({ ...two, type: "radial" })).toBe("radial-gradient(circle, #43afcd 0%, #75a02f 100%)");
  });

  it("emits no double quote, so the style attribute cannot be truncated", () => {
    // The trap lib/richText.ts's header describes: sanitiseHtml stops at the delimiting
    // quote, the styling survives on screen, and the export loses it.
    const css = gradientCss(two);
    expect(css).not.toContain('"');
    const html = `<span style="background-image: ${css}">x</span>`;
    expect(sanitiseHtml(html)).toBe(html);
  });

  it("survives the sanitiser, which is the thing that had to be true for any of this", () => {
    // linear-gradient() contains no `url(`, so the blocklist in lib/slideElements.ts lets
    // it through. This test is here so that stays true if the blocklist is ever widened.
    for (const g of [two, { ...two, type: "radial" as const }]) {
      const html = `<span style="background-image: ${gradientCss(g)}; background-clip: text">x</span>`;
      expect(sanitiseHtml(html)).toBe(html);
    }
  });
});

describe("normaliseGradient", () => {
  it("sorts stops by position rather than trusting the order given", () => {
    const g = normaliseGradient({ ...two, stops: [{ color: "#a00", at: 80 }, { color: "#0a0", at: 20 }] });
    expect(g.stops.map((s) => s.at)).toEqual([20, 80]);
  });

  it("clamps positions into 0–100", () => {
    const g = normaliseGradient({ ...two, stops: [{ color: "#a00", at: -50 }, { color: "#0a0", at: 900 }] });
    expect(g.stops.map((s) => s.at)).toEqual([0, 100]);
  });

  it("caps the stop count, so a pasted row cannot push a deck over the autosave ceiling", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ color: "#000", at: i }));
    expect(normaliseGradient({ ...two, stops: many }).stops).toHaveLength(MAX_STOPS);
  });

  it("brings any angle back into 0–359, and treats 360 as 0", () => {
    expect(normaliseGradient({ ...two, angle: 360 }).angle).toBe(0);
    expect(normaliseGradient({ ...two, angle: -90 }).angle).toBe(270);
    expect(normaliseGradient({ ...two, angle: 450 }).angle).toBe(90);
    expect(normaliseGradient({ ...two, angle: NaN }).angle).toBe(0);
  });

  it("drops a stop with no colour instead of writing an empty one", () => {
    const g = normaliseGradient({ ...two, stops: [{ color: "", at: 0 }, { color: "#0a0", at: 50 }] });
    expect(g.stops).toHaveLength(1);
  });
});

describe("isDrawableGradient", () => {
  it("refuses anything that is not actually a gradient", () => {
    // One stop is a colour with extra steps, and would render as nothing.
    expect(isDrawableGradient(two)).toBe(true);
    expect(isDrawableGradient({ ...two, stops: [two.stops[0]] })).toBe(false);
    expect(isDrawableGradient(undefined)).toBe(false);
    expect(isDrawableGradient(null)).toBe(false);
  });
});

describe("parseGradientCss reads what the app already has", () => {
  it("reads the brand gradients, which carry no stop positions at all", () => {
    // lib/tokens.ts writes `linear-gradient(120deg, #009BDD, #75A02F)`. The editor has to
    // open on that rather than resetting to something else the moment it is touched.
    const g = parseGradientCss(GRAD)!;
    expect(g.angle).toBe(120);
    expect(g.stops.map((s) => s.at)).toEqual([0, 100]);
    expect(g.stops).toHaveLength(2);
  });

  it("reads a three-stop brand gradient with explicit positions", () => {
    const g = parseGradientCss(KONVERZ_GRAD)!;
    expect(g.angle).toBe(90);
    expect(g.stops.map((s) => s.at)).toEqual([0, 50, 100]);
  });

  it("reads the dark ramp too", () => {
    expect(parseGradientCss(GRAD_DARK)!.stops).toHaveLength(3);
  });

  it("does not split a stop colour that contains its own commas", () => {
    // `rgba(1, 2, 3, 0.5)` is ONE stop. A naive comma split makes it four.
    const g = parseGradientCss("linear-gradient(90deg, rgba(1, 2, 3, 0.5) 0%, #fff 100%)")!;
    expect(g.stops).toHaveLength(2);
    expect(g.stops[0].color).toBe("rgba(1, 2, 3, 0.5)");
  });

  it("does not mistake a percentage inside a colour for a stop position", () => {
    // `hsl(210 100% 40%)` ends in a percentage that is part of the colour.
    const g = parseGradientCss("linear-gradient(90deg, hsl(210 100% 40%), #fff)")!;
    expect(g.stops[0].color).toBe("hsl(210 100% 40%)");
    expect(g.stops[0].at).toBe(0);
  });

  it("reads keyword directions as angles", () => {
    expect(parseGradientCss("linear-gradient(to right, #000, #fff)")!.angle).toBe(90);
    expect(parseGradientCss("linear-gradient(to top, #000, #fff)")!.angle).toBe(0);
    // Clockwise from "up": right is 90 and bottom is 180, so the corner between them is 135.
    expect(parseGradientCss("linear-gradient(to bottom right, #000, #fff)")!.angle).toBe(135);
    expect(parseGradientCss("linear-gradient(to top right, #000, #fff)")!.angle).toBe(45);
  });

  it("defaults to `to bottom` when no direction is given, as CSS does", () => {
    expect(parseGradientCss("linear-gradient(#000, #fff)")!.angle).toBe(180);
  });

  it("reads a radial, including one with a shape and position prelude", () => {
    const g = parseGradientCss("radial-gradient(circle at 30% 40%, #000 0%, #fff 100%)")!;
    expect(g.type).toBe("radial");
    expect(g.stops).toHaveLength(2);
  });

  it("returns null for something that is not a gradient", () => {
    expect(parseGradientCss("#ff0000")).toBeNull();
    expect(parseGradientCss("none")).toBeNull();
    expect(parseGradientCss("")).toBeNull();
    expect(parseGradientCss("linear-gradient(90deg, #fff)")).toBeNull();
  });

  it("round-trips its own output byte for byte", () => {
    const css = gradientCss(two);
    expect(gradientCss(parseGradientCss(css)!)).toBe(css);
  });
});

describe("svgGradientCoords", () => {
  // CSS measures from "up" and turns clockwise; SVG wants two points, with y running DOWN
  // the screen. Getting this wrong is an off-by-90 that looks plausible in one direction
  // and wrong in the other three, so the four cardinals are pinned explicitly.
  it("puts the four cardinal directions exactly where CSS puts them", () => {
    expect(svgGradientCoords(0)).toEqual({ x1: "0.5", y1: "1", x2: "0.5", y2: "0" });
    expect(svgGradientCoords(90)).toEqual({ x1: "0", y1: "0.5", x2: "1", y2: "0.5" });
    expect(svgGradientCoords(180)).toEqual({ x1: "0.5", y1: "0", x2: "0.5", y2: "1" });
    expect(svgGradientCoords(270)).toEqual({ x1: "1", y1: "0.5", x2: "0", y2: "0.5" });
  });

  it("reaches the corners at 45°, rather than stopping short of them", () => {
    // The half-length is the CSS gradient-line length for a unit box. Without it a
    // diagonal gradient finishes early and banding shows at the corners.
    expect(svgGradientCoords(45)).toEqual({ x1: "0", y1: "1", x2: "1", y2: "0" });
    expect(svgGradientCoords(135)).toEqual({ x1: "0", y1: "0", x2: "1", y2: "1" });
  });

  it("treats 360 as 0 and a negative angle as its positive twin", () => {
    expect(svgGradientCoords(360)).toEqual(svgGradientCoords(0));
    expect(svgGradientCoords(-90)).toEqual(svgGradientCoords(270));
  });

  it("emits short, stable numbers so the exported markup does not churn", () => {
    for (const a of [0, 30, 45, 120, 200, 359]) {
      for (const v of Object.values(svgGradientCoords(a))) {
        expect(v).not.toContain("e");
        expect(v.replace("-", "").replace(".", "").length, `${a} gave ${v}`).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe("defaultGradient", () => {
  it("opens on something drawable", () => {
    expect(isDrawableGradient(defaultGradient("#000", "#fff"))).toBe(true);
  });
});
