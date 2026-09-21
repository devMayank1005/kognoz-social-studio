// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Modal, Drawer } from "./Modal";
import { Button } from "./Button";

// The behaviours none of the five overlays had.
//
// Every assertion below corresponds to something that was missing in production before
// this primitive existed: Escape did nothing, Tab walked out of the dialog into the page
// behind it, focus was abandoned on close, the page scrolled under the backdrop, and
// selecting text in a dialog and releasing the mouse outside it closed the dialog and
// threw the selection away.

afterEach(cleanup);

function open(props: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const onClose = vi.fn();
  const view = render(
    <Modal isOpen onClose={onClose} title="Test dialog" {...props}>
      <p>Body</p>
      <button type="button">Inner</button>
    </Modal>
  );
  return { onClose, ...view };
}

describe("Modal", () => {
  it("renders exactly nothing when closed", () => {
    // components/overlaySmoke.test.tsx pins this for HelpModal. A hidden-but-mounted
    // dialog would look identical and still hold focus and still read to a screen reader.
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Test dialog">
        body
      </Modal>
    );
    expect(container.innerHTML).toBe("");
  });

  it("closes on Escape", () => {
    const { onClose } = open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the press starts and ends on the backdrop", () => {
    const { onClose } = open();
    const backdrop = screen.getByRole("dialog").parentElement!;
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when a drag that began inside the panel ends on the backdrop", () => {
    // Select a sentence, overshoot, release outside. ContentEditorModal.tsx:370 had this
    // guard; the overlays copied everything except it.
    const { onClose } = open();
    const panel = screen.getByRole("dialog");
    const backdrop = panel.parentElement!;
    fireEvent.mouseDown(panel);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from the header × button", () => {
    const { onClose } = open();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks body scroll while open and restores it on close", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = open();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
  });

  it("takes focus on open and gives it back on close", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = open();
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("wraps Tab from the last control back to the first", () => {
    open({ footer: <Button>Got it</Button> });
    const panel = screen.getByRole("dialog");
    const controls = [...panel.querySelectorAll("button")];
    const last = controls[controls.length - 1];
    last.focus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(controls[0]);
  });

  it("wraps Shift+Tab from the panel itself to the last control", () => {
    open({ footer: <Button>Got it</Button> });
    const panel = screen.getByRole("dialog");
    const controls = [...panel.querySelectorAll("button")];

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(controls[controls.length - 1]);
  });

  it("names itself for assistive tech, from the title when no label is given", () => {
    open();
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Test dialog");
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it("prefers an explicit label over a non-string title", () => {
    render(
      <Modal isOpen onClose={() => {}} label="Export deck" title={<span>Export</span>}>
        body
      </Modal>
    );
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Export deck");
  });

  it("hides the × when the dialog must be dismissed deliberately", () => {
    open({ hideClose: true });
    expect(screen.queryByLabelText("Close")).toBeNull();
  });
});

describe("Drawer", () => {
  it("is a Modal anchored right, with the same behaviours", () => {
    const onClose = vi.fn();
    render(
      <Drawer isOpen onClose={onClose} title="Export">
        body
      </Drawer>
    );
    expect(screen.getByRole("dialog").className).toContain("h-full");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Button", () => {
  it("defaults to type=button so it cannot submit a form it happens to sit in", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  });

  it("still allows an explicit submit", () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("submit");
  });

  it("does not fire when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
