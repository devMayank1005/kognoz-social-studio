"use client";

import React from "react";
import { AppShell } from "@/components/shell/AppShell";
import { useBrand } from "@/components/BrandProvider";
import { BRANDS, BRAND_IDS } from "@/lib/brands";
import { DESIGN_SETS, KONVERZ_DESIGN_SETS, LOOK_SETS, KONVERZ_LOOK_SETS, TOTAL_LOOKS } from "@/lib/designSets";
import { FONTS } from "@/lib/fontRegistry";
import { UI_FONT, MONO_FONT, DISPLAY_FONT, FONT, KONVERZ_FONT, AUDIT_OK, AUDIT_WARN } from "@/lib/tokens";

// The design system reference. PRD §3 / §4.
//
// Everything here is READ FROM THE LIVE TABLES — lib/designSets.ts, lib/brands.ts,
// lib/fontRegistry.ts — rather than transcribed. A reference page that restates values
// by hand is wrong the first time someone changes one, and being quietly wrong is worse
// than not existing, because people trust it.

export function DesignSystemView() {
  const brand = useBrand();
  const C = brand.C;

  const setsFor = (id: string) => (id === "konverz" ? KONVERZ_DESIGN_SETS : DESIGN_SETS);
  const looksFor = (id: string) => (id === "konverz" ? KONVERZ_LOOK_SETS : LOOK_SETS);

  const card: React.CSSProperties = {
    border: `1px solid ${C.line}`,
    borderRadius: 10,
    background: C.white,
    padding: 16
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 940, fontFamily: UI_FONT }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>Design System</h2>
        <p style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.6, margin: "0 0 26px" }}>
          Read from the same tables Studio draws with, so this page cannot drift from what actually gets
          exported.
        </p>

        {/* ---------------- Type ---------------- */}
        <Section title="Type" C={C}>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 18 }}>
            <Specimen
              C={C}
              role="Display — slides"
              note="Fraunces. Every slide headline sets this at weight 600."
              style={{ fontFamily: DISPLAY_FONT, fontSize: 34, fontWeight: 600, letterSpacing: "-0.015em" }}
            />
            <Specimen
              C={C}
              role="Body — Kognoz slides"
              note="Open Sans."
              style={{ fontFamily: FONT, fontSize: 18, fontWeight: 400 }}
            />
            <Specimen
              C={C}
              role="Body — Konverz slides"
              note="Poppins. Observed across the deck and site, not confirmed as official."
              style={{ fontFamily: KONVERZ_FONT, fontSize: 18, fontWeight: 400 }}
            />
            <Specimen
              C={C}
              role="Interface"
              note="Plus Jakarta Sans. Chrome only — never reaches a slide or an export."
              style={{ fontFamily: UI_FONT, fontSize: 18, fontWeight: 500 }}
            />
            <Specimen
              C={C}
              role="Metrics"
              note="JetBrains Mono, tabular numerals: 0123456789 lines up in a column."
              style={{ fontFamily: MONO_FONT, fontSize: 16, fontVariantNumeric: "tabular-nums" }}
              sample="0123456789 · 14.96.50.18 · $0.0081"
            />
          </div>
        </Section>

        {/* ---------------- Where each face is allowed to go ---------------- */}
        <Section title="Font loading" C={C}>
          <p style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6, margin: "0 0 12px" }}>
            A <strong>slide</strong> face is embedded as base64 into every exported PNG and PDF. A{" "}
            <strong>chrome</strong> face never is — that separation is what keeps exports from carrying
            typefaces no slide uses.
          </p>
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: C.off }}>
                  <Th C={C}>Family</Th>
                  <Th C={C}>Used by</Th>
                  <Th C={C}>Weights requested</Th>
                </tr>
              </thead>
              <tbody>
                {FONTS.map((f) => (
                  <tr key={f.family} style={{ borderTop: `1px solid ${C.line}` }}>
                    <Td C={C} bold>
                      {f.family}
                    </Td>
                    <Td C={C}>
                      {f.uses.map((u) => (
                        <span
                          key={u}
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 9,
                            marginRight: 5,
                            color: u === "chrome" ? C.inkMute : "#fff",
                            background: u === "chrome" ? C.mist : C.blue
                          }}
                        >
                          {u === "chrome" ? "chrome" : u.replace("-slide", " slide")}
                        </span>
                      ))}
                    </Td>
                    <Td C={C} mono>
                      {f.axis}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ---------------- Design families ---------------- */}
        <Section title="Design families" C={C}>
          <p style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6, margin: "0 0 12px" }}>
            One family holds a whole deck — uniformity is a tested invariant. “Next look” cycles{" "}
            {TOTAL_LOOKS} uniform combinations (families × accent tones).
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {BRAND_IDS.map((id) => {
              const b = BRANDS[id];
              const sets = setsFor(id);
              const cycled = looksFor(id);
              return (
                <div key={id} style={card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: "#fff",
                        background: b.GRAD,
                        padding: "3px 10px",
                        borderRadius: 10
                      }}
                    >
                      {b.label}
                    </span>
                    <span style={{ fontSize: 11.5, color: C.inkMute }}>
                      {Object.keys(sets).length} families
                    </span>
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {Object.entries(sets).map(([setId, spec]) => (
                      <li
                        key={setId}
                        style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5, color: C.ink }}
                      >
                        <span style={{ fontFamily: MONO_FONT, fontSize: 11, color: C.inkMute, minWidth: 82 }}>
                          {setId}
                        </span>
                        <span style={{ fontWeight: 600 }}>{spec?.label}</span>
                        {!cycled.includes(setId as never) && (
                          <span style={{ fontSize: 10.5, color: C.inkMute }}>· not in the cycle</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ---------------- Palette ---------------- */}
        <Section title="Palette" C={C}>
          {BRAND_IDS.map((id) => {
            const b = BRANDS[id];
            return (
              <div key={id} style={{ ...card, marginBottom: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 10 }}>{b.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {Object.entries(b.C).map(([name, hex]) => (
                    <Swatch key={name} name={name} hex={hex} C={C} />
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    height: 34,
                    borderRadius: 7,
                    background: b.GRAD,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 12,
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  Gradient
                </div>
              </div>
            );
          })}

          <div style={card}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Status</div>
            <div style={{ fontSize: 11.5, color: C.inkMute, marginBottom: 10, lineHeight: 1.5 }}>
              The only two roles the brand palettes do not cover. Shared by both brands, because a verified
              fact means the same thing either way.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Swatch name="AUDIT_OK" hex={AUDIT_OK} C={C} />
              <Swatch name="AUDIT_WARN" hex={AUDIT_WARN} C={C} />
            </div>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

type Palette = { ink: string; inkSoft: string; inkMute: string; line: string; off: string; white: string };

function Section({ title, children, C }: { title: string; children: React.ReactNode; C: Palette }) {
  return (
    <section style={{ marginBottom: 30 }}>
      <h3
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: C.inkMute,
          margin: "0 0 10px"
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function Specimen({
  role,
  note,
  style,
  sample = "Measure what people do, not what they say",
  C
}: {
  role: string;
  note: string;
  style: React.CSSProperties;
  sample?: string;
  C: Palette;
}) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: C.inkMute }}>
        {role}
      </div>
      <div style={{ ...style, color: C.ink, margin: "5px 0 3px" }}>{sample}</div>
      <div style={{ fontSize: 11.5, color: C.inkMute, lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}

function Swatch({ name, hex, C }: { name: string; hex: string; C: Palette }) {
  return (
    <div style={{ width: 92 }}>
      <div style={{ height: 40, borderRadius: 7, background: hex, border: `1px solid ${C.line}` }} />
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.ink, marginTop: 4 }}>{name}</div>
      <div style={{ fontFamily: MONO_FONT, fontSize: 10, color: C.inkMute }}>{hex}</div>
    </div>
  );
}

function Th({ children, C }: { children: React.ReactNode; C: Palette }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "9px 14px",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: C.inkMute
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  C,
  bold,
  mono
}: {
  children: React.ReactNode;
  C: Palette;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      style={{
        padding: "9px 14px",
        color: bold ? C.ink : C.inkSoft,
        fontWeight: bold ? 700 : 400,
        fontFamily: mono ? MONO_FONT : undefined,
        fontSize: mono ? 11 : undefined,
        wordBreak: mono ? "break-all" : undefined
      }}
    >
      {children}
    </td>
  );
}
