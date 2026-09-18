// The app's destinations, in one place.
//
// Pure and I/O-free, like lib/formats.ts, so three things that must agree cannot drift:
// the sidebar, the ⌘K command palette, and the active-state highlight. Before this
// existed there was no list at all — Studio, Calendar and the activity log each built
// their own header, and the article writer was reachable only from inside a
// 2,564-line component, which is why nobody could find it.
//
// Adding a destination is one entry here. It then appears in the sidebar and the
// palette automatically.

export type NavId = "studio" | "calendar" | "articles" | "style" | "design" | "audit";

export interface NavItem {
  id: NavId;
  /** Sidebar label. Short — the rail is 232px wide. */
  label: string;
  href: string;
  /** One line, shown in the command palette. Says what the screen is FOR. */
  hint: string;
  /** Hidden from people outside ADMIN_EMAILS. The API re-checks; this is not the gate. */
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "studio", label: "Studio", href: "/studio", hint: "Write and design a post" },
  { id: "calendar", label: "Calendar", href: "/calendar", hint: "Plan the month" },
  { id: "articles", label: "Articles", href: "/articles", hint: "Write a long-form article" },
  { id: "style", label: "Style & Voice", href: "/style", hint: "Brand voice, house rules, banned words" },
  { id: "design", label: "Design System", href: "/design", hint: "Type scale and design families" },
  { id: "audit", label: "Activity", href: "/admin/activity", hint: "Who did what, and when", adminOnly: true }
];

/** The default destination. `/` redirects here. */
export const HOME_HREF = "/studio";

/** What the sidebar shows this person. */
export function visibleNavItems(isAdmin: boolean | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin === true);
}

/**
 * Which destination a path belongs to.
 *
 * Longest match wins, and a match must be the whole href or a path SEGMENT under it —
 * so `/studio` never claims `/studio-archive`, and `/admin/activity` is not swallowed
 * by a shorter entry. Returns null for a path outside the app's navigation (`/login`),
 * so the sidebar highlights nothing rather than guessing.
 */
export function activeNavId(pathname: string | null | undefined): NavId | null {
  const path = (pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  if (path === "/") return "studio"; // `/` redirects to Studio; highlight it immediately

  let best: NavItem | null = null;
  for (const item of NAV_ITEMS) {
    if (path === item.href || path.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best ? best.id : null;
}

/** The item for an id, or null. */
export function navItem(id: NavId): NavItem | null {
  return NAV_ITEMS.find((i) => i.id === id) ?? null;
}
