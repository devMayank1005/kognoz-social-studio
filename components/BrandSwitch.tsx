// The brand toggle, shared by the Studio sidebar and the calendar header.
//
// Everything downstream of this reads the active brand: palette, fonts, logo,
// motif, pillars, channels, design sets, the ground truth in every prompt, the
// voice corpus, and which saved calendar and house style load. Switching is
// cheap and fully reversible — the two brands keep entirely separate stored
// data under their own keys — so it is a plain two-up toggle and not a confirm.
"use client";

import React from "react";
import { BRAND_IDS, BRANDS } from "@/lib/brands";
import { useBrandSwitch } from "./BrandProvider";

export function BrandSwitch({
  disabled,
  compact,
  style
}: {
  /** True while a generation is in flight; switching mid-call would strand it. */
  disabled?: boolean;
  /** Header variant: sits inline rather than filling the width. */
  compact?: boolean;
  style?: React.CSSProperties;
}) {
  const { brand, brandId, setBrandId } = useBrandSwitch();
  const C = brand.C;

  return (
    <div
      role="radiogroup"
      aria-label="Brand"
      style={{ display: "flex", gap: compact ? 4 : 6, ...style }}
    >
      {BRAND_IDS.map((id) => {
        const on = brandId === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setBrandId(id)}
            disabled={disabled}
            title={disabled ? "Finish or cancel the current generation first" : `Produce for ${BRANDS[id].name}`}
            style={{
              flex: compact ? undefined : 1,
              fontFamily: brand.font,
              fontSize: compact ? 11.5 : 12,
              fontWeight: 700,
              padding: compact ? "5px 11px" : "7px 10px",
              borderRadius: 8,
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.55 : 1,
              border: `1px solid ${on ? "transparent" : C.line}`,
              color: on ? "#fff" : C.inkMute,
              background: on ? BRANDS[id].GRAD : "transparent",
              whiteSpace: "nowrap"
            }}
          >
            {BRANDS[id].label}
          </button>
        );
      })}
    </div>
  );
}
