// The app's destinations, in one place.
//
// Pure and I/O-free, like lib/formats.ts, so three things that must agree cannot drift:
// the sidebar, the ⌘K command palette, and the active-state highlight.
//
// Shape follows the reference UI (github.com/devMayank1005/demo-frontend,
// src/components/Sidebar.tsx) — four sections, badges on the right of a row. Two
// deliberate differences:
//
//   Routes, not state.  The reference is one page switching on an `activeNav` union.
//                       We keep real Next routes, so URLs are shareable and the back
//                       button works.
//   Settings is a modal. It sits in the ADMIN section but opens an overlay rather than
//                       navigating, exactly as the reference does.

export type NavId =
  | "studio"
  | "calendar"
  | "articles"
  | "assets"
  | "style"
  | "voice"
  | "design"
  | "audit"
  | "settings";

export type NavSection = "workspace" | "style" | "admin";

/** Section order and headings, as the sidebar prints them. */
export const SECTIONS: { id: NavSection; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "style", label: "Style" },
  { id: "admin", label: "Admin" }
];

export type BadgeKind =
  /** A small chip, e.g. Studio's "AI". */
  | "chip"
  /** A mono count supplied at render time, e.g. Calendar's item total. */
  | "count"
  /** A status dot, e.g. Activity's health indicator. */
  | "dot";

export interface NavItem {
  id: NavId;
  /** Sidebar label. Short — the rail is 232px. */
  label: string;
  /** Where it goes. Absent for an item that opens a modal instead. */
  href?: string;
  section: NavSection;
  /** One line, shown in the command palette. Says what the screen is FOR. */
  hint: string;
  /**
   * The heading the topbar prints, which is longer and more formal than the rail's
   * label — "Calendar" in 232px, "Content Calendar" across the top. Taken from the
   * reference UI's getPageTitle(). Kept here so the two cannot drift.
   */
  pageTitle: string;
  /** Hidden from people outside ADMIN_EMAILS. The API re-checks; this is not the gate. */
  adminOnly?: boolean;
  badge?: BadgeKind;
  /** Literal text for a "chip" badge. */
  badgeText?: string;
  /** Opens an overlay rather than navigating. */
  modal?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  // ---- Workspace ----
  {
    id: "studio",
    label: "Studio",
    href: "/studio",
    section: "workspace",
    hint: "Write and design a post",
    pageTitle: "Studio",
    badge: "chip",
    badgeText: "AI"
  },
  {
    id: "calendar",
    label: "Calendar",
    href: "/calendar",
    section: "workspace",
    hint: "Plan the month",
    pageTitle: "Content Calendar",
    badge: "count"
  },
  {
    id: "articles",
    label: "Articles",
    href: "/articles",
    section: "workspace",
    hint: "Write a long-form article",
    pageTitle: "Article Writer"
  },
  {
    id: "assets",
    label: "Assets",
    href: "/assets",
    section: "workspace",
    hint: "Images and files for your posts",
    pageTitle: "Asset Library"
  },

  // ---- Style ----
  {
    id: "style",
    label: "House Style",
    href: "/style",
    section: "style",
    hint: "Tone, writing rules, banned words",
    pageTitle: "House Style & Editorial Guidelines"
  },
  {
    id: "voice",
    label: "Voice",
    href: "/voice",
    section: "style",
    hint: "Real writing the model imitates",
    pageTitle: "Brand Voice Samples",
    badge: "count"
  },
  {
    id: "design",
    label: "Design",
    href: "/design",
    section: "style",
    hint: "Type scale and design families",
    pageTitle: "Design System & Visual Standards"
  },

  // ---- Admin ----
  {
    id: "audit",
    label: "Activity",
    href: "/admin/activity",
    section: "admin",
    hint: "Who did what, and when",
    pageTitle: "Admin Audit & Activity",
    adminOnly: true,
    badge: "dot"
  },
  {
    id: "settings",
    label: "Settings",
    section: "admin",
    hint: "Workspace configuration",
    pageTitle: "Workspace Settings",
    adminOnly: true,
    modal: true
  }
];

/** The default destination. `/` redirects here. */
export const HOME_HREF = "/studio";

/** What the sidebar shows this person. */
export function visibleNavItems(isAdmin: boolean | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin === true);
}

/** The visible items of one section, in declared order. Empty sections are not rendered. */
export function sectionItems(section: NavSection, isAdmin: boolean | undefined): NavItem[] {
  return visibleNavItems(isAdmin).filter((i) => i.section === section);
}

/**
 * Which destination a path belongs to.
 *
 * Longest match wins, and a match must be the whole href or a path SEGMENT under it —
 * so `/studio` never claims `/studio-archive`, and `/admin/activity` is not swallowed by
 * a shorter entry. Returns null for a path outside the app's navigation (`/login`), so
 * the sidebar highlights nothing rather than guessing.
 */
export function activeNavId(pathname: string | null | undefined): NavId | null {
  const path = (pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  if (path === "/") return "studio"; // `/` redirects to Studio; highlight it immediately

  let best: NavItem | null = null;
  for (const item of NAV_ITEMS) {
    if (!item.href) continue; // a modal has no path to match
    if (path === item.href || path.startsWith(item.href + "/")) {
      if (!best || !best.href || item.href.length > best.href.length) best = item;
    }
  }
  return best ? best.id : null;
}

/** The item for an id, or null. */
export function navItem(id: NavId): NavItem | null {
  return NAV_ITEMS.find((i) => i.id === id) ?? null;
}
