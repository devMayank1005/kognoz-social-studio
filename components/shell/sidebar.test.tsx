// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Sidebar, SIDEBAR_WIDTH, SIDEBAR_WIDTH_COLLAPSED } from "./Sidebar";

// The first component test in this repo that actually mounts something.
//
// Everything before this used renderToStaticMarkup, which its own files admit cannot see
// "a click that does nothing" or "two elements overlapping". Sidebar was one of the 25
// components with no coverage of any kind — and it is where the collapsed rail recently
// rendered at 232px while its inline style said 64px, a bug no source-text test could
// have caught.
//
// The three mocks are exactly why it was untested: the rail needs a router, a session and
// the brand context. None of that is hard, it just had to be done once.

vi.mock("next/navigation", () => ({ usePathname: () => "/studio" }));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { name: "Test Person", email: "t@example.com", isAdmin: false } } }),
  signOut: vi.fn()
}));

vi.mock("@/components/BrandProvider", () => ({
  useBrandSwitch: () => ({ brandId: "kognoz", setBrandId: vi.fn() })
}));

afterEach(cleanup);

const rail = () => document.getElementById("app-sidebar") as HTMLElement;

describe("Sidebar — expanded", () => {
  it("is the full width and shows its labels", () => {
    render(<Sidebar />);
    expect(rail().style.width).toBe(`${SIDEBAR_WIDTH}px`);
    expect(screen.getByText("Calendar")).toBeTruthy();
    expect(screen.getByText("WORKSPACE".toLowerCase(), { exact: false })).toBeTruthy();
  });

  it("marks the current page, so the rail says where you are", () => {
    render(<Sidebar />);
    expect(document.getElementById("nav-studio-btn")?.getAttribute("aria-current")).toBe("page");
    expect(document.getElementById("nav-calendar-btn")?.getAttribute("aria-current")).toBeNull();
  });
});

describe("Sidebar — collapsed", () => {
  it("is the narrow width, and the inline style and the class agree", () => {
    // The regression: a width transition applied before first paint left the box at its
    // start value, so the style said 64px and the element measured 232px.
    render(<Sidebar collapsed />);
    expect(rail().style.width).toBe(`${SIDEBAR_WIDTH_COLLAPSED}px`);
    expect(rail().className).not.toMatch(/transition-\[width\]/);
  });

  it("drops the labels but keeps every destination reachable and named", () => {
    render(<Sidebar collapsed />);
    expect(screen.queryByText("Calendar")).toBeNull();
    const link = document.getElementById("nav-calendar-btn") as HTMLElement;
    expect(link).toBeTruthy();
    // With the words gone, the hover title and the accessible name are the only things
    // telling you what the icon is.
    expect(link.getAttribute("title")).toBe("Calendar");
    expect(link.getAttribute("aria-label")).toBe("Calendar");
  });

  it("still reports its own state to assistive tech", () => {
    render(<Sidebar collapsed onToggleCollapsed={() => {}} />);
    const toggle = document.getElementById("sidebar-collapse-btn") as HTMLElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-label")).toBe("Expand sidebar");
  });
});

describe("Sidebar — the collapse control", () => {
  it("is absent when the shell cannot collapse, rather than dead", () => {
    render(<Sidebar />);
    expect(document.getElementById("sidebar-collapse-btn")).toBeNull();
  });

  it("asks the shell to toggle rather than owning the state itself", () => {
    const onToggleCollapsed = vi.fn();
    render(<Sidebar onToggleCollapsed={onToggleCollapsed} />);
    (document.getElementById("sidebar-collapse-btn") as HTMLElement).click();
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });
});
