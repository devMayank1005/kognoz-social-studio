"use client";

import type { NavId } from "@/lib/navigation";

// Inline SVG rather than an icon package.
//
// The app has no icon dependency and this adds none — six 18px glyphs are not worth
// 40kB and a supply-chain surface. They are stroke-only on `currentColor`, so the
// active/inactive colour is decided by the sidebar row and never duplicated here.
//
// Decorative by default: the label sits next to every one of these in the sidebar, so
// announcing the glyph too would make a screen reader say everything twice. Where an
// icon appears WITHOUT a label, the caller passes a title and it becomes an image with
// an accessible name.

const PATHS: Record<NavId, React.ReactNode> = {
  // A slide on an easel — the deck editor.
  studio: (
    <>
      <rect x="3" y="3" width="14" height="11" rx="1.6" />
      <path d="M10 14v3M7 17h6" />
    </>
  ),
  // A month grid.
  calendar: (
    <>
      <rect x="3" y="4" width="14" height="13" rx="1.6" />
      <path d="M3 8h14M7 2.5v3M13 2.5v3" />
    </>
  ),
  // Lines of running text.
  articles: (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" rx="1.4" />
      <path d="M6.5 7h7M6.5 10h7M6.5 13h4" />
    </>
  ),
  // A quill nib — voice and house style.
  style: (
    <>
      <path d="M16.5 3.5c-5 .8-8.3 3.4-9.9 7.8L5 15l3.7-1.6c4.4-1.6 7-4.9 7.8-9.9Z" />
      <path d="M8.7 11.3 4 16" />
    </>
  ),
  // Overlapping swatches — the design families.
  design: (
    <>
      <circle cx="7.5" cy="7.5" r="4" />
      <circle cx="12.5" cy="12.5" r="4" />
    </>
  ),
  // A clock — the activity timeline.
  audit: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4.2l2.8 1.7" />
    </>
  )
};

export function NavIcon({
  id,
  size = 18,
  title
}: {
  id: NavId;
  size?: number;
  /** Only when the icon stands alone. With a visible label, leave this off. */
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      style={{ flexShrink: 0, display: "block" }}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[id]}
    </svg>
  );
}
