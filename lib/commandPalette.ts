// What the ⌘K palette offers, and how typing narrows it.
//
// Pure and I/O-free so the matching and the keyboard arithmetic can be tested without a
// DOM. The component is then only markup and event wiring.
//
// Commands are DERIVED from lib/navigation.ts rather than listed again. The reference UI
// hardcodes its own list, which is how its palette ended up advertising "Content
// Calendar — 24 Planned Items" from mock data and offering destinations without checking
// whether the person may see them. Deriving means a new destination appears here for
// free, and an admin-only one stays hidden.

import { NAV_ITEMS, type NavId, type NavItem } from "./navigation";
import { BRAND_IDS, BRANDS, type BrandId } from "./brands";

export type CommandKind = "navigate" | "brand" | "action";

export interface Command {
  id: string;
  title: string;
  /** Right-hand chip: which group this belongs to. */
  category: string;
  kind: CommandKind;
  /** For a navigate command. */
  navId?: NavId;
  href?: string;
  /** For a brand command. */
  brandId?: BrandId;
  /** For an action command, e.g. fact check. */
  actionId?: string;
}

const SECTION_CATEGORY: Record<NavItem["section"], string> = {
  workspace: "Workspace",
  style: "Style",
  admin: "System"
};

export interface CommandContext {
  isAdmin: boolean | undefined;
  /** The brand in use — it is not offered as something to switch to. */
  currentBrand: BrandId;
  /** Page-supplied actions, present only where they mean something. */
  canFactCheck?: boolean;
  canExport?: boolean;
}

/** Everything on offer, in the order the palette lists it. */
export function buildCommands(ctx: CommandContext): Command[] {
  const out: Command[] = [];

  for (const item of NAV_ITEMS) {
    // The same gate the sidebar uses. A palette that lists a destination the person
    // cannot open is worse than one that omits it.
    if (item.adminOnly && ctx.isAdmin !== true) continue;
    // Settings opens a modal and is reached from the rail; listing it here would need a
    // second way to open the same overlay for no benefit.
    if (item.modal) continue;

    out.push({
      id: `nav-${item.id}`,
      title: `${item.pageTitle} — ${item.hint}`,
      category: SECTION_CATEGORY[item.section],
      kind: "navigate",
      navId: item.id,
      href: item.href
    });
  }

  if (ctx.canFactCheck) {
    out.push({
      id: "action-fact-check",
      title: "Run fact verification against the live web",
      category: "Editorial",
      kind: "action",
      actionId: "fact-check"
    });
  }

  if (ctx.canExport) {
    out.push({
      id: "action-export",
      title: "Export this deck — PDF, PNG carousel, panorama",
      category: "Publish",
      kind: "action",
      actionId: "export"
    });
  }

  for (const id of BRAND_IDS) {
    // Offering a switch to the brand you are already in does nothing and pushes a real
    // option off the visible list.
    if (id === ctx.currentBrand) continue;
    out.push({
      id: `brand-${id}`,
      title: `Switch to ${BRANDS[id].name}`,
      category: "Brand",
      kind: "brand",
      brandId: id
    });
  }

  return out;
}

/**
 * Narrow by what was typed.
 *
 * Every whitespace-separated term must appear somewhere in the title or the category, so
 * "voice kog" finds the Kognoz voice screen. Substring rather than prefix, because
 * people type the distinctive middle of a word ("verif", "panorama") as often as the
 * start.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return commands;
  return commands.filter((c) => {
    const hay = `${c.title} ${c.category}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

/**
 * Where the highlight lands after an arrow key.
 *
 * Wraps at both ends — at the last item, Down returns to the first — because a list you
 * can walk off the end of makes you reverse all the way back. Clamped for an empty list
 * so the caller never indexes into nothing.
 */
export function moveSelection(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((current + delta) % length) + length) % length;
}

/** Keep the highlight in range after the list shrinks under a new query. */
export function clampSelection(current: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(current, 0), length - 1);
}
