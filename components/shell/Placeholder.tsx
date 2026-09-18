"use client";

import React from "react";
import { useBrand } from "@/components/BrandProvider";
import { UI_FONT } from "@/lib/tokens";

// A destination that exists in the navigation but is not built yet.
//
// It says what will live here AND where that capability is today, because a bare
// "coming soon" tells someone nothing about whether they can get their work done.
export function Placeholder({
  title,
  summary,
  willInclude,
  todayInstead
}: {
  title: string;
  summary: string;
  willInclude: string[];
  todayInstead?: string;
}) {
  const C = useBrand().C;

  return (
    <div style={{ maxWidth: 680, fontFamily: UI_FONT }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>{title}</h2>
      <p style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.6, margin: "0 0 18px" }}>{summary}</p>

      <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.off, padding: "16px 18px" }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: C.inkMute,
            marginBottom: 10
          }}
        >
          Not built yet — this screen will hold
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {willInclude.map((line) => (
            <li key={line} style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>
              {line}
            </li>
          ))}
        </ul>
        {todayInstead && (
          <p
            style={{
              fontSize: 12.5,
              color: C.inkMute,
              lineHeight: 1.55,
              margin: "14px 0 0",
              paddingTop: 12,
              borderTop: `1px solid ${C.line}`
            }}
          >
            {todayInstead}
          </p>
        )}
      </div>
    </div>
  );
}
