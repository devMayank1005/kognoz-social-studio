// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ColorPicker from "./ColorPicker";
import { RECENT_COLORS_KEY } from "@/lib/recentColors";
import type { Gradient } from "@/lib/gradient";

// What is worth pinning here is not the layout but the ways a colour control wastes
// somebody's time or lies to them:
//
//  - the old inputs guarded with /^#[0-9a-f]{6}$/i, so every rgba(), every computed rgb()
//    and every `transparent` displayed as BLACK while being something else;
//  - a half-typed value must not recolour anything, but a complete one must;
//  - EyeDropper is Chromium-only, and a button that does nothing is worse than no button;
//  - a popover that will not close reads as stuck.

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  // jsdom has no EyeDropper, which is the default this suite assumes.
  delete (window as unknown as Record<string, unknown>).EyeDropper;
});

const tokens = { font: "sans-serif", ink: "#212121", line: "#dce6eb", inkMute: "#6b7680" };

function open(props: Partial<React.ComponentProps<typeof ColorPicker>> = {}) {
  const onChange = props.onChange ?? vi.fn();
  const view = render(
    <ColorPicker value="#43afcd" title="Text colour" onChange={onChange} {...tokens} {...props} />
  );
  fireEvent.click(screen.getByRole("button", { name: "Text colour" }));
  return { onChange, ...view };
}

describe("the popover", () => {
  it("opens on the trigger and says what it is", () => {
    open();
    expect(screen.getByRole("dialog", { name: "Text colour" })).toBeTruthy();
  });

  it("closes on Escape", () => {
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on a press anywhere else", () => {
    open();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open when the press is inside it", () => {
    open();
    fireEvent.pointerDown(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("does not open at all when disabled", () => {
    render(<ColorPicker value="#43afcd" title="Text colour" onChange={vi.fn()} disabled {...tokens} />);
    fireEvent.click(screen.getByRole("button", { name: "Text colour" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the value field", () => {
  const field = () => screen.getByLabelText("Colour value") as HTMLInputElement;

  it("shows the real colour rather than falling back to black", () => {
    // The whole reason this component exists. `rgba(…)` is not six-digit hex, and the old
    // input rendered it as #000000 while the canvas showed something else entirely.
    open({ value: "rgba(67, 175, 205, 0.5)" });
    expect(field().value).toBe("#43afcd80");
  });

  it("shows `transparent` as transparent, not as black", () => {
    open({ value: "transparent" });
    expect(field().value).toBe("#00000000");
  });

  it("switches between hex, rgb and hsl", () => {
    open();
    fireEvent.click(screen.getByLabelText("RGB"));
    expect(field().value).toBe("rgb(67, 175, 205)");
    fireEvent.click(screen.getByLabelText("HSL"));
    expect(field().value).toBe("hsl(193, 58%, 53%)");
  });

  it("accepts a typed value in any of the three dialects", () => {
    const { onChange } = open();
    for (const typed of ["#ff0000", "rgb(255, 0, 0)", "hsl(0, 100%, 50%)"]) {
      fireEvent.change(field(), { target: { value: typed } });
      expect(onChange).toHaveBeenCalledWith(typed);
    }
  });

  it("does nothing at all while the value is still half-typed", () => {
    // Committing on every keystroke is how the old control recoloured text to black on the
    // way through "#f".
    const { onChange } = open();
    // Note `#ff00` is NOT in this list: four-digit hex is a real colour (red at zero alpha),
    // and treating it as incomplete would refuse a value somebody legitimately typed.
    for (const partial of ["#", "#f", "#ff", "#ff0f0", "rgb(255,"]) {
      fireEvent.change(field(), { target: { value: partial } });
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts four-digit hex, which is a colour and not a half-typed one", () => {
    const { onChange } = open();
    fireEvent.change(field(), { target: { value: "#ff00" } });
    expect(onChange).toHaveBeenCalledWith("#ff00");
  });

  it("keeps what was typed visible until it loses focus", () => {
    open();
    fireEvent.change(field(), { target: { value: "#ff0f0" } });
    expect(field().value).toBe("#ff0f0");
  });
});

describe("alpha", () => {
  it("reports the opacity of the colour it was given", () => {
    open({ value: "rgba(67, 175, 205, 0.5)" });
    expect((screen.getByLabelText("Opacity") as HTMLInputElement).value).toBe("50");
  });

  it("keeps the exact opacity chosen rather than quantising it", () => {
    // Via eight-bit hex, 50% comes back as 50.2% and the number drifts as you drag.
    const { onChange } = open();
    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith("rgba(67, 175, 205, 0.5)");
  });

  it("goes back to plain hex at full opacity", () => {
    const { onChange } = open({ value: "rgba(67, 175, 205, 0.5)" });
    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "100" } });
    expect(onChange).toHaveBeenCalledWith("#43afcd");
  });
});

describe("the eyedropper", () => {
  it("is absent where the browser does not have one", () => {
    // Chromium-only. A permanently dead button is worse than no button.
    open();
    expect(screen.queryByLabelText("Pick a colour from the screen")).toBeNull();
  });

  it("appears where the browser does", () => {
    (window as unknown as Record<string, unknown>).EyeDropper = class {
      open() {
        return Promise.resolve({ sRGBHex: "#123456" });
      }
    };
    open();
    expect(screen.getByLabelText("Pick a colour from the screen")).toBeTruthy();
  });
});

describe("palettes", () => {
  it("offers the brand colours it was handed", () => {
    const { onChange } = open({ brand: ["#005184", "#43afcd"] });
    fireEvent.click(screen.getByLabelText("#005184"));
    expect(onChange).toHaveBeenCalledWith("#005184");
  });

  it("offers the colours already on the canvas", () => {
    const { onChange } = open({ documentColors: ["#abcdef"] });
    fireEvent.click(screen.getByLabelText("#abcdef"));
    expect(onChange).toHaveBeenCalledWith("#abcdef");
  });

  it("remembers a colour after it is used, across a reopen", () => {
    const { onChange } = open({ brand: ["#005184"] });
    fireEvent.click(screen.getByLabelText("#005184"));
    expect(onChange).toHaveBeenCalled();
    // Reopen: Recent is read from localStorage when the panel opens.
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Text colour" }));
    expect(screen.getByText("Recent")).toBeTruthy();
  });

  it("does not remember a colour merely looked at", () => {
    open();
    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "20" } });
    expect(window.localStorage.getItem(RECENT_COLORS_KEY)).toBeNull();
  });

  it("saves a colour to the deck palette, and takes it out again", () => {
    const onPaletteChange = vi.fn();
    open({ palette: ["#111111"], onPaletteChange });
    fireEvent.click(screen.getByLabelText("Save this colour to the deck"));
    expect(onPaletteChange).toHaveBeenCalledWith(["#111111", "#43afcd"]);
    fireEvent.click(screen.getByLabelText("Remove #111111"));
    expect(onPaletteChange).toHaveBeenCalledWith([]);
  });

  it("does not add the same colour to the palette twice", () => {
    const onPaletteChange = vi.fn();
    open({ value: "#111111", palette: ["#111111"], onPaletteChange });
    fireEvent.click(screen.getByLabelText("Save this colour to the deck"));
    expect(onPaletteChange).not.toHaveBeenCalled();
  });

  it("hides a palette that has nothing in it rather than showing an empty row", () => {
    open();
    expect(screen.queryByText("Brand")).toBeNull();
    expect(screen.queryByText("In this deck")).toBeNull();
  });
});

describe("clearing", () => {
  it("offers the caller's own clear action when there is one", () => {
    const onClear = vi.fn();
    render(
      <ColorPicker value="#43afcd" title="Highlight" onChange={vi.fn()} onClear={onClear} clearLabel="None" {...tokens} />
    );
    fireEvent.click(screen.getByTitle("None"));
    expect(onClear).toHaveBeenCalled();
  });
});

describe("gradients", () => {
  const gradient: Gradient = {
    type: "linear",
    angle: 90,
    stops: [
      { color: "#43afcd", at: 0 },
      { color: "#75a02f", at: 100 }
    ]
  };

  it("offers no gradient tab when the caller cannot take one", () => {
    // A text highlight and a shape stroke have nowhere to put a gradient.
    open();
    expect(screen.queryByText("Gradient")).toBeNull();
  });

  it("seeds a new gradient from the colour already there, rather than resetting", () => {
    const onGradientChange = vi.fn();
    open({ value: "#ff0000", gradient: null, onGradientChange });
    fireEvent.click(screen.getByText("Gradient"));
    expect(onGradientChange).toHaveBeenCalledWith(
      expect.objectContaining({ stops: [{ color: "#ff0000", at: 0 }, { color: "#ffffff", at: 100 }] })
    );
  });

  it("drops the gradient when switched back to solid", () => {
    const onGradientChange = vi.fn();
    open({ gradient, onGradientChange });
    fireEvent.click(screen.getByText("Solid"));
    expect(onGradientChange).toHaveBeenCalledWith(null);
  });

  it("shows a marker per stop", () => {
    open({ gradient, onGradientChange: vi.fn() });
    expect(screen.getByLabelText("Stop 1 at 0%")).toBeTruthy();
    expect(screen.getByLabelText("Stop 2 at 100%")).toBeTruthy();
  });

  it("changes the angle", () => {
    const onGradientChange = vi.fn();
    open({ gradient, onGradientChange });
    fireEvent.change(screen.getByLabelText("Gradient angle"), { target: { value: "45" } });
    expect(onGradientChange).toHaveBeenCalledWith(expect.objectContaining({ angle: 45 }));
  });

  it("switches between linear and radial", () => {
    const onGradientChange = vi.fn();
    open({ gradient, onGradientChange });
    fireEvent.click(screen.getByText("Radial"));
    expect(onGradientChange).toHaveBeenCalledWith(expect.objectContaining({ type: "radial" }));
  });

  it("hides the angle for a radial, which has none", () => {
    open({ gradient: { ...gradient, type: "radial" }, onGradientChange: vi.fn() });
    expect(screen.queryByLabelText("Gradient angle")).toBeNull();
  });

  it("edits the SELECTED stop's colour, not the element's", () => {
    const onChange = vi.fn();
    const onGradientChange = vi.fn();
    open({ gradient, onChange, onGradientChange });
    fireEvent.change(screen.getByLabelText("Colour value"), { target: { value: "#000000" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(onGradientChange).toHaveBeenCalledWith(
      expect.objectContaining({ stops: [{ color: "#000000", at: 0 }, { color: "#75a02f", at: 100 }] })
    );
  });

  it("will not remove a stop when only the minimum are left", () => {
    // One stop is not a gradient; it would render as nothing.
    const onGradientChange = vi.fn();
    open({ gradient, onGradientChange });
    const remove = screen.getByLabelText("Remove this stop") as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
  });

  it("removes a stop once there are more than the minimum", () => {
    const onGradientChange = vi.fn();
    open({
      gradient: { ...gradient, stops: [...gradient.stops, { color: "#000000", at: 50 }] },
      onGradientChange
    });
    fireEvent.click(screen.getByLabelText("Remove this stop"));
    expect(onGradientChange).toHaveBeenCalledWith(expect.objectContaining({ stops: expect.any(Array) }));
    expect(onGradientChange.mock.calls[0][0].stops).toHaveLength(2);
  });
});
