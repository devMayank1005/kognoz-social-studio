import { describe, it, expect } from "vitest";
import { NAV_ITEMS, HOME_HREF, visibleNavItems, activeNavId, navItem } from "./navigation";

// The sidebar, the command palette and the active-state highlight all read this module.
// If it is wrong, one of them silently disagrees with the other two.

describe("the destination list", () => {
  it("has a unique id and href for every entry", () => {
    expect(new Set(NAV_ITEMS.map((i) => i.id)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(NAV_ITEMS.length);
  });

  it("gives every entry a label and a hint, because the palette shows both", () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.hint.length).toBeGreaterThan(0);
      expect(item.href.startsWith("/")).toBe(true);
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
