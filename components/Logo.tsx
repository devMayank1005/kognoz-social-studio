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
  mark,
  style,
  brand = KOGNOZ
}: {
  h?: number;
  white?: boolean;
  full?: boolean;
  /**
   * Render the mark rather than the wordmark — for the collapsed rail, where there is no
   * room for words. Check `brand.logos.markAspect` before using it: a brand without a real
   * mark file points `mark` at its wordmark, and squashing that into a square looks broken.
   */
  mark?: boolean;
  style?: React.CSSProperties;
  brand?: Brand;
}) {
  const { color, white: whiteLogo, mark: markLogo, aspect, markAspect } = brand.logos;
  const src = mark ? markLogo : full || white ? whiteLogo : color;
  const ratio = mark ? markAspect : aspect;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- exported slides
    // are serialized to SVG/canvas; next/image's runtime wrapper doesn't
    // survive that pipeline, so this stays a plain <img> like the original.
    <img
      src={src}
      alt={brand.name}
      style={{
        height: h,
        width: Math.round(h * ratio),
        objectFit: "contain",
        objectPosition: "left center",
        display: "block",
        flexShrink: 0,
        ...style
      }}
    />
  );
}
