// Logo — ported verbatim from kognoz-social-studio-v3.jsx's `Logo` component,
// now pointing at the real extracted PNGs instead of inline base64 (same
// bytes, just served as static files rather than data URLs). Aspect ratio
// 3.6:1 confirmed against the actual assets (PRD §3.4).
"use client";

const LOGO_COLOR = "/brand/kognoz-logo-full-color.png";
const LOGO_WHITE = "/brand/kognoz-logo-white.png";
// jsx's LOGO_FULL_WHITE was an alias for LOGO_WHITE (same asset) — kept as
// the same file here too, so `full` and `white` render identically, exactly
// as in the reference implementation.
const LOGO_FULL_WHITE = LOGO_WHITE;

export function Logo({
  h = 48,
  white,
  full,
  style
}: {
  h?: number;
  white?: boolean;
  full?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- exported slides
    // are serialized to SVG/canvas; next/image's runtime wrapper doesn't
    // survive that pipeline, so this stays a plain <img> like the original.
    <img
      src={full ? LOGO_FULL_WHITE : white ? LOGO_WHITE : LOGO_COLOR}
      alt="Kognoz"
      style={{
        height: h,
        width: Math.round(h * 3.6),
        objectFit: "contain",
        objectPosition: "left center",
        display: "block",
        flexShrink: 0,
        ...style
      }}
    />
  );
}
