// @vitest-environment jsdom

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// The first tests either of these files has ever had.
//
// They were excluded from components/overlaySmoke.test.tsx — the only render test this
// repo had — because both call useSession(), and there was no way to provide one in a
// node environment. jsdom plus three mocks is the whole difficulty, and it only had to
// be solved once.

const push = vi.fn();
const setBrandId = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { name: "Test Person", email: "t@example.com", isAdmin: false } }
  })
}));

vi.mock("@/components/BrandProvider", () => ({
  useBrandSwitch: () => ({ brandId: "kognoz", setBrandId })
}));

import { SettingsModal } from "./SettingsModal";
import { CommandPalette } from "./CommandPalette";

// jsdom implements no layout and therefore no scrollIntoView. The palette calls it to
// keep the highlighted row on screen; that is real behaviour in a browser and a missing
// function here, so it is stubbed rather than guarded in the component.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  push.mockClear();
  setBrandId.mockClear();
});

describe("SettingsModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<SettingsModal isOpen={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the signed-in account on the first pane", () => {
    render(<SettingsModal isOpen onClose={() => {}} />);
    expect(screen.getByText("Test Person")).toBeTruthy();
    expect(screen.getByText("t@example.com")).toBeTruthy();
    // Not an admin, so the role must not claim otherwise.
    expect(screen.getByText("Editor")).toBeTruthy();
    expect(screen.queryByText("Administrator")).toBeNull();
  });

  it("switches panes", () => {
    render(<SettingsModal isOpen onClose={() => {}} />);
    expect(screen.queryByText(/Saved the moment you pick one/)).toBeNull();
    fireEvent.click(screen.getByText("Workspace brands"));
    expect(screen.getByText(/Saved the moment you pick one/)).toBeTruthy();
  });

  it("switches brand from the brands pane", () => {
    render(<SettingsModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText("Workspace brands"));
    fireEvent.click(screen.getByText("Konverz AI"));
    expect(setBrandId).toHaveBeenCalledWith("konverz");
  });

  it("closes on Escape — which it did not do before the primitive", () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<CommandPalette isOpen={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("leaves focus in the search field rather than taking it to the dialog", () => {
    // The regression the dialog's focus guard exists for: an autoFocus input is focused
    // during the commit that mounts it, BEFORE the dialog's effect runs. A dialog that
    // focused itself unconditionally would swallow the first keystroke.
    render(<CommandPalette isOpen onClose={() => {}} />);
    expect(document.activeElement).toBe(screen.getByLabelText("Search commands"));
  });

  it("filters as you type", () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    const all = screen.getAllByRole("button").length;
    fireEvent.change(screen.getByLabelText("Search commands"), { target: { value: "calendar" } });
    const filtered = screen.getAllByRole("button").length;
    expect(filtered).toBeLessThan(all);
    expect(screen.getByText(/Calendar/)).toBeTruthy();
  });

  it("says so when nothing matches", () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Search commands"), { target: { value: "zzzzz" } });
    expect(screen.getByText("No matching commands or destinations.")).toBeTruthy();
  });

  it("opens the highlighted result with Enter", () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Search commands"), { target: { value: "calendar" } });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/calendar");
    expect(onClose).toHaveBeenCalled();
  });

  it("moves the highlight with the arrow keys", () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    const first = screen.getAllByRole("button")[0];
    expect(first.getAttribute("data-selected")).toBe("true");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getAllByRole("button")[0].getAttribute("data-selected")).toBe("false");
    expect(screen.getAllByRole("button")[1].getAttribute("data-selected")).toBe("true");
  });

  it("closes on Escape, which the dialog now owns", () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides admin-only destinations from a non-admin", () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Search commands"), { target: { value: "activity" } });
    expect(screen.getByText("No matching commands or destinations.")).toBeTruthy();
  });
});
