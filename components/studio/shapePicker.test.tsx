// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ShapePicker from "./ShapePicker";
import { SHAPE_LIBRARY } from "@/lib/shapeLibrary";

// The picker replaced four toolbar buttons that offered three shapes between them. What is
// worth pinning is not the styling but the three ways it can waste somebody's time: a
// popover that will not close, a search that does not find the thing, and a tile that
// inserts a different shape from the one it drew.

afterEach(cleanup);

function open(onPick = vi.fn()) {
  const view = render(
    <ShapePicker onPick={onPick} font="sans-serif" ink="#0B1F33" line="#DDE5EA" inkMute="#7B8C99" accent="#43AFCD" />
  );
  fireEvent.click(screen.getByRole("button", { name: /shape/i }));
  return { onPick, ...view };
}

describe("ShapePicker", () => {
  it("shows nothing until it is opened", () => {
    render(
      <ShapePicker onPick={vi.fn()} font="sans-serif" ink="#0B1F33" line="#DDE5EA" inkMute="#7B8C99" accent="#43AFCD" />
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("offers the whole library at once", () => {
    open();
    expect(screen.getAllByRole("menuitem")).toHaveLength(SHAPE_LIBRARY.length);
  });

  it("draws each tile from the shape's own geometry, not an icon set", () => {
    // The reason this matters: pick the tile that looks like a pentagon and you must get
    // that pentagon. An icon set is free to disagree with the renderer, and would.
    open();
    const tile = screen.getByTitle("Pentagon");
    const path = tile.querySelector("path");
    expect(path?.getAttribute("d")).toBeTruthy();
    // Five vertices, so five coordinate pairs before the close.
    expect((path?.getAttribute("d") ?? "").split("L")).toHaveLength(5);
  });

  it("finds a shape by a word somebody would actually type", () => {
    open();
    fireEvent.change(screen.getByLabelText("Search shapes"), { target: { value: "bubble" } });
    expect(screen.getByTitle("Speech balloon")).toBeTruthy();
    expect(screen.queryByTitle("Pentagon")).toBeNull();
  });

  it("says so when nothing matches instead of showing an empty grid", () => {
    open();
    fireEvent.change(screen.getByLabelText("Search shapes"), { target: { value: "zzzzz" } });
    expect(screen.getByText("No shape matches that.")).toBeTruthy();
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  it("hands back the entry that was clicked, and closes", () => {
    const { onPick } = open();
    fireEvent.click(screen.getByTitle("Shield"));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0]).toMatchObject({ id: "shield", kind: "shield" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("distinguishes two entries that share a kind", () => {
    // Rectangle and Rounded rectangle are both `rect`; only the defaults differ. Getting
    // this wrong means the rounded tile silently inserts a square-cornered box.
    const { onPick } = open();
    fireEvent.click(screen.getByTitle("Rounded rectangle"));
    expect(onPick.mock.calls[0][0]).toMatchObject({ kind: "rect", defaults: { radius: 36 } });
  });

  it("closes on Escape", () => {
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on a press outside it", () => {
    open();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("forgets the search when it closes, so it reopens on the full set", () => {
    open();
    fireEvent.change(screen.getByLabelText("Search shapes"), { target: { value: "heart" } });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /shape/i }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(SHAPE_LIBRARY.length);
  });

  it("inserts the highlighted shape on Enter", () => {
    const { onPick } = open();
    fireEvent.change(screen.getByLabelText("Search shapes"), { target: { value: "heart" } });
    fireEvent.keyDown(screen.getByLabelText("Search shapes"), { key: "Enter" });
    expect(onPick.mock.calls[0][0]).toMatchObject({ id: "heart" });
  });
});
