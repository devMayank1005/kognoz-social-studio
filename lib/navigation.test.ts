import { describe, it, expect } from "vitest";
import { NAV_ITEMS, SECTIONS, HOME_HREF, visibleNavItems, sectionItems, activeNavId, navItem } from "./navigation";

// The sidebar, the command palette and the active-state highlight all read this module.
// If it is wrong, one of them silently disagrees with the other two.

describe("the destination list", () => {
  it("has a unique id and href for every entry", () => {
    expect(new Set(NAV_ITEMS.map((i) => i.id)).size).toBe(NAV_ITEMS.length);
    const hrefs = NAV_ITEMS.map((i) => i.href).filter(Boolean);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("gives every entry a label and a hint, because the palette shows both", () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.hint.length).toBeGreaterThan(0);
      // Settings opens a modal and has no href; everything else navigates.
      if (item.href) expect(item.href.startsWith("/")).toBe(true);
      else expect(item.modal).toBe(true);
    }
  });

  it("points home at a real destination", () => {
    expect(NAV_ITEMS.some((i) => i.href === HOME_HREF)).toBe(true);
  });

  it("includes the article writer as a destination of its own", () => {
    // The whole point of this phase: it used to live inside Studio, where it could
    // not be found without being told where to look.
    expect(NAV_ITEMS.find((i) => i.id === "articles")?.href).toBe("/articles");
  });
});

describe("visibleNavItems", () => {
  it("hides admin-only entries from everyone else", () => {
    const ids = visibleNavItems(false).map((i) => i.id);
    expect(ids).not.toContain("audit");
    expect(ids).toContain("studio");
  });

  it("treats undefined as not an admin", () => {
    // A session still loading must not flash a link the person cannot follow.
    expect(visibleNavItems(undefined).map((i) => i.id)).not.toContain("audit");
  });

  it("shows them to an admin", () => {
    expect(visibleNavItems(true).map((i) => i.id)).toContain("audit");
  });

  it("keeps the declared order either way", () => {
    expect(visibleNavItems(true).map((i) => i.id)).toEqual(NAV_ITEMS.map((i) => i.id));
    expect(visibleNavItems(false).map((i) => i.id)).toEqual(
      NAV_ITEMS.filter((i) => !i.adminOnly).map((i) => i.id)
    );
  });
});

describe("activeNavId", () => {
  it("matches a destination exactly", () => {
    expect(activeNavId("/studio")).toBe("studio");
    expect(activeNavId("/calendar")).toBe("calendar");
    expect(activeNavId("/admin/activity")).toBe("audit");
  });

  it("highlights Studio at the root, which redirects there", () => {
    expect(activeNavId("/")).toBe("studio");
    expect(activeNavId("")).toBe("studio");
  });

  it("matches a path nested under a destination", () => {
    expect(activeNavId("/articles/draft-123")).toBe("articles");
    expect(activeNavId("/admin/activity/2026-09")).toBe("audit");
  });

  it("does NOT match a sibling that merely shares a prefix", () => {
    // "/studio-archive" starts with "/studio" as a string but is a different route.
    // A naive startsWith would light up the wrong sidebar item.
    expect(activeNavId("/studio-archive")).toBeNull();
    expect(activeNavId("/calendars")).toBeNull();
  });

  it("returns null outside the app's navigation", () => {
    // /login has no sidebar. Highlighting something there would be a lie.
    expect(activeNavId("/login")).toBeNull();
    expect(activeNavId("/api/claude")).toBeNull();
  });

  it("falls back to Studio for a missing path rather than throwing", () => {
    for (const empty of [null, undefined]) expect(activeNavId(empty)).toBe("studio");
  });

  it("ignores a query string and a trailing slash", () => {
    expect(activeNavId("/studio?format=Carousel")).toBe("studio");
    expect(activeNavId("/calendar/")).toBe("calendar");
    expect(activeNavId("/admin/activity/?who=someone")).toBe("audit");
  });

  it("prefers the longest matching destination", () => {
    // Guards the case where a future "/admin" entry is added above "/admin/activity":
    // the more specific one has to win or the highlight lands on the wrong row.
    expect(activeNavId("/admin/activity")).toBe("audit");
  });
});

describe("navItem", () => {
  it("finds an entry by id", () => {
    expect(navItem("style")?.href).toBe("/style");
  });

  it("returns null rather than undefined for an unknown id", () => {
    expect(navItem("nope" as never)).toBeNull();
  });
});

// The registry now drives a sectioned sidebar, matching the reference UI.
describe("sections", () => {
  it("puts every item in a declared section", () => {
    const known = new Set(SECTIONS.map((s) => s.id));
    for (const item of NAV_ITEMS) expect(known.has(item.section)).toBe(true);
  });

  it("no section is empty for an admin", () => {
    for (const s of SECTIONS) expect(sectionItems(s.id, true).length).toBeGreaterThan(0);
  });

  it("groups the workspace destinations in the reference's order", () => {
    expect(sectionItems("workspace", false).map((i) => i.id)).toEqual([
      "studio",
      "calendar",
      "articles",
      "assets"
    ]);
  });

  it("splits house style from voice, as the reference does", () => {
    expect(sectionItems("style", false).map((i) => i.id)).toEqual(["style", "voice", "design"]);
  });

  it("hides the whole admin section from a non-admin", () => {
    // Both of its rows are adminOnly, so the heading must not render either.
    expect(sectionItems("admin", false)).toHaveLength(0);
    expect(sectionItems("admin", true).map((i) => i.id)).toEqual(["audit", "settings"]);
  });

  it("every section's items are contiguous in the declared order", () => {
    // The sidebar renders section by section; an item declared out of order would
    // silently jump group.
    const seen: string[] = [];
    for (const item of NAV_ITEMS) if (seen[seen.length - 1] !== item.section) seen.push(item.section);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("badges", () => {
  it("gives Studio the AI chip the reference shows", () => {
    const studio = navItem("studio");
    expect(studio?.badge).toBe("chip");
    expect(studio?.badgeText).toBe("AI");
  });

  it("marks Calendar and Voice as counts, which the sidebar is GIVEN", () => {
    // The sidebar must not fetch them; a nav registry that did I/O would be untestable.
    expect(navItem("calendar")?.badge).toBe("count");
    expect(navItem("voice")?.badge).toBe("count");
  });

  it("marks Activity as a status dot", () => {
    expect(navItem("audit")?.badge).toBe("dot");
  });
});

describe("Settings is a modal, not a route", () => {
  it("has no href and is flagged as a modal", () => {
    expect(navItem("settings")?.href).toBeUndefined();
    expect(navItem("settings")?.modal).toBe(true);
  });

  it("never wins the active-route match", () => {
    // An item with no href must be skipped by activeNavId rather than crashing it.
    expect(activeNavId("/settings")).toBeNull();
    expect(() => activeNavId("/anything")).not.toThrow();
  });
});
