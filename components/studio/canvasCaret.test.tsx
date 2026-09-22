// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import CanvasEditor from "./CanvasEditor";
import ElementInspector from "./ElementInspector";
import { createText } from "@/lib/slideElements";

// The first tests CanvasEditor has ever had, and they cover the one thing per-range styling
// depends on.
//
// While a caret is live, CanvasEditor installs a document-level listener in the CAPTURE
// phase that blurs the editable and ends the edit on any press outside it. The styling bar
// sits outside the preview, so without an exemption every press of it would throw the
// selection away before the control's own handler ran — and the toolbar cannot defend
// itself, because preventDefault does not stop a capture-phase listener on the document.

afterEach(cleanup);

const EL = createText([], { x: 10, y: 10, w: 200, h: 60 });
const EDITING_ID = EL.id;

/** Everything CanvasEditor needs, with the caret live on our element. */
function editorProps(onEditingChange: () => void) {
  return {
    active: true,
    elements: [EL],
    baseW: 1080,
    baseH: 1350,
    previewScale: 0.5,
    exportRootId: "exp-0",
    selectedId: EL.id,
    onSelect: vi.fn(),
    onCommit: vi.fn(),
    onDraggingChange: vi.fn(),
    editingId: EDITING_ID,
    onEditingChange
  };
}

/** The DOM CanvasEditor looks the editable up in — `#preview-slide [data-el-id="…"]`. */
function mountPreview() {
  const preview = document.createElement("div");
  preview.id = "preview-slide";
  const editable = document.createElement("div");
  editable.setAttribute("data-el-id", EDITING_ID);
  editable.setAttribute("contenteditable", "true");
  preview.appendChild(editable);
  document.body.appendChild(preview);
  return { preview, editable };
}

function press(target: Element) {
  target.dispatchEvent(new Event("pointerdown", { bubbles: true }));
}

describe("the caret survives the styling bar", () => {
  it("does not end the edit when the press lands on chrome marked data-keep-caret", () => {
    const { preview } = mountPreview();
    const onEditingChange = vi.fn();

    const bar = document.createElement("div");
    bar.setAttribute("data-keep-caret", "");
    const control = document.createElement("button");
    bar.appendChild(control);
    document.body.appendChild(bar);

    render(<CanvasEditor {...editorProps(onEditingChange)} />);
    press(control);

    expect(onEditingChange).not.toHaveBeenCalled();

    preview.remove();
    bar.remove();
  });

  it("still ends the edit for a press on anything else", () => {
    // The exemption must be narrow: this is the behaviour it is carved out of.
    const { preview } = mountPreview();
    const onEditingChange = vi.fn();

    const elsewhere = document.createElement("button");
    document.body.appendChild(elsewhere);

    render(<CanvasEditor {...editorProps(onEditingChange)} />);
    press(elsewhere);

    expect(onEditingChange).toHaveBeenCalledWith(null);

    preview.remove();
    elsewhere.remove();
  });

  it("does not end the edit for a press inside the editable itself", () => {
    const { preview, editable } = mountPreview();
    const onEditingChange = vi.fn();

    render(<CanvasEditor {...editorProps(onEditingChange)} />);
    press(editable);

    expect(onEditingChange).not.toHaveBeenCalled();
    preview.remove();
  });
});

describe("the styling bar holds up its end of that contract", () => {
  it("marks itself data-keep-caret", () => {
    // If this attribute is ever dropped, the exemption above silently stops applying and
    // per-range styling becomes impossible to use — the selection dies on the first click.
    const { container } = render(
      <ElementInspector
        element={EL}
        fonts={[{ label: "Fraunces", value: "'Fraunces', serif", weights: [400, 600] }]}
        swatches={["#0B1F33"]}
        onChange={vi.fn()}
        font="sans-serif"
        ink="#0B1F33"
        line="#DDE5EA"
        inkMute="#7B8C99"
      />
    );
    expect(container.querySelector("[data-keep-caret]")).not.toBeNull();
  });

  it("shows how many characters a control is about to hit", () => {
    const { getByText } = render(
      <ElementInspector
        element={EL}
        fonts={[{ label: "Fraunces", value: "'Fraunces', serif", weights: [400, 600] }]}
        swatches={["#0B1F33"]}
        onChange={vi.fn()}
        selection={{ length: 7, style: { color: "#43AFCD" } }}
        onRunStyle={vi.fn(() => true)}
        font="sans-serif"
        ink="#0B1F33"
        line="#DDE5EA"
        inkMute="#7B8C99"
      />
    );
    expect(getByText("7 characters")).toBeTruthy();
  });

  it("sends a change to the range when one is selected, not to the element", () => {
    const onChange = vi.fn();
    const onRunStyle = vi.fn(() => true);
    const { container } = render(
      <ElementInspector
        element={EL}
        fonts={[{ label: "Fraunces", value: "'Fraunces', serif", weights: [400, 600] }]}
        swatches={["#0B1F33"]}
        onChange={onChange}
        selection={{ length: 4, style: { color: "#43AFCD" } }}
        onRunStyle={onRunStyle}
        font="sans-serif"
        ink="#0B1F33"
        line="#DDE5EA"
        inkMute="#7B8C99"
      />
    );
    const swatch = container.querySelector('[title="#0B1F33"]') as HTMLElement;
    swatch.click();

    expect(onRunStyle).toHaveBeenCalledWith({ color: "#0B1F33" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("falls back to the whole element when the range turns out to be unusable", () => {
    // onRunStyle returning false means the saved range no longer points at live nodes. The
    // bar must still do something, or the control looks broken.
    const onChange = vi.fn();
    const { container } = render(
      <ElementInspector
        element={EL}
        fonts={[{ label: "Fraunces", value: "'Fraunces', serif", weights: [400, 600] }]}
        swatches={["#0B1F33"]}
        onChange={onChange}
        selection={{ length: 4, style: { color: "#43AFCD" } }}
        onRunStyle={vi.fn(() => false)}
        font="sans-serif"
        ink="#0B1F33"
        line="#DDE5EA"
        inkMute="#7B8C99"
      />
    );
    (container.querySelector('[title="#0B1F33"]') as HTMLElement).click();
    expect(onChange).toHaveBeenCalledWith({ color: "#0B1F33" });
  });

  it("styles the whole element when nothing is selected", () => {
    const onChange = vi.fn();
    const onRunStyle = vi.fn(() => true);
    const { container } = render(
      <ElementInspector
        element={EL}
        fonts={[{ label: "Fraunces", value: "'Fraunces', serif", weights: [400, 600] }]}
        swatches={["#0B1F33"]}
        onChange={onChange}
        selection={null}
        onRunStyle={onRunStyle}
        font="sans-serif"
        ink="#0B1F33"
        line="#DDE5EA"
        inkMute="#7B8C99"
      />
    );
    (container.querySelector('[title="#0B1F33"]') as HTMLElement).click();

    expect(onChange).toHaveBeenCalledWith({ color: "#0B1F33" });
    expect(onRunStyle).not.toHaveBeenCalled();
  });
});
