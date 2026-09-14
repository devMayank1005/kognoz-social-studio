// Logo — ported verbatim from kognoz-social-studio-v3.jsx's `Logo` component,
// now pointing at the real extracted PNGs instead of inline base64 (same
// bytes, just served as static files rather than data URLs).
//
// Brand-aware since Konverz arrived. The aspect ratio is a per-brand number
// rather than a constant: the Kognoz wordmark is 3.6:1 and the Konverz one is
// 6.24:1, so a shared multiplier would stretch one of them. Both are confirmed
// against the actual PNG dimensions, not taken from a brand document.
"use client";

import { KOGNOZ, type Brand } from "@/lib/brands";

export function Logo({
  h = 48,
  white,
  full,
  style,
  brand = KOGNOZ
}: {
  h?: number;
  white?: boolean;
  full?: boolean;
  style?: React.CSSProperties;
  brand?: Brand;
}) {
  const { color, white: whiteLogo, aspect } = brand.logos;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- exported slides
    // are serialized to SVG/canvas; next/image's runtime wrapper doesn't
    // survive that pipeline, so this stays a plain <img> like the original.
    <img
      src={full || white ? whiteLogo : color}
      alt={brand.name}
      style={{
        height: h,
        width: Math.round(h * aspect),
        objectFit: "contain",
        objectPosition: "left center",
        display: "block",
        flexShrink: 0,
        ...style
      }}
    />
  );
}
