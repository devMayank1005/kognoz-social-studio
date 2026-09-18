"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ArticleWriter } from "@/components/ArticleWriter";
import { useBrand } from "@/components/BrandProvider";
import { storeGet } from "@/lib/storeClient";
import { brandKey } from "@/lib/brands";
import { coerceSamples, type VoiceSample } from "@/lib/voiceSamples";
import { FONT } from "@/lib/tokens";

// The article writer as a destination of its own.
//
// PRD §4.3 asks for a centred document column. The writer itself is shared with
// Studio's Article Cover panel — this page only supplies what the writer needs to know
// (topic, pillar, byline) and the voice corpus to imitate.

const COLUMN = 780;

export function ArticlesView() {
  const brand = useBrand();
  const C = brand.C;
  const k = (name: string) => brandKey(brand, name);

  const [topic, setTopic] = useState("");
  const [pillar, setPillar] = useState<string>(() => Object.keys(brand.pillars)[0] ?? "");
  const [channel, setChannel] = useState<string>(brand.defaultChannel);
  const [voiceSamples, setVoiceSamples] = useState<VoiceSample[]>([]);
  const [error, setError] = useState("");
  const [passNote, setPassNote] = useState("");
  const [seed] = useState(() => Math.floor(Math.random() * 1000));

  // Reset to this brand's defaults and reload its corpus whenever the brand changes.
  // The two brands keep entirely separate stored data under their own keys.
  useEffect(() => {
    let cancelled = false;
    setPillar(Object.keys(brand.pillars)[0] ?? "");
    setChannel(brand.defaultChannel);
    setVoiceSamples([]);
    storeGet<unknown>(k("voice-samples"))
      .then((r) => {
        if (!cancelled) setVoiceSamples(coerceSamples(r.value));
      })
      .catch(() => {
        /* offline — the writer still works, just with nothing to imitate */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the brand only
  }, [brand.id]);

  const labelStyle: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: C.inkMute,
    marginBottom: 8,
    display: "block"
  };
  const fieldStyle: React.CSSProperties = {
    fontFamily: FONT,
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    fontSize: 13.5,
    color: C.ink,
    background: C.white,
    boxSizing: "border-box",
    outline: "none"
  };

  return (
    <AppShell>
      <div style={{ maxWidth: COLUMN, margin: "0 auto", fontFamily: FONT }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>Write an article</h2>
        <p style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.6, margin: "0 0 20px" }}>
          Long-form, in {brand.name}&apos;s voice. Markdown headings paste straight into LinkedIn&apos;s article
          editor.{" "}
          {voiceSamples.length === 0 && (
            <strong style={{ color: C.inkMute, fontWeight: 600 }}>
              No voice samples saved for this brand yet — the draft will be written with no human writing to
              imitate.
            </strong>
          )}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 14
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle} htmlFor="article-topic">
              Topic
            </label>
            <input
              id="article-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. why engagement scores stay high while attrition climbs"
              style={fieldStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="article-pillar">
              Pillar
            </label>
            <select id="article-pillar" value={pillar} onChange={(e) => setPillar(e.target.value)} style={fieldStyle}>
              {Object.keys(brand.pillars).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="article-channel">
              Byline
            </label>
            <select id="article-channel" value={channel} onChange={(e) => setChannel(e.target.value)} style={fieldStyle}>
              {Object.keys(brand.channels).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "#FFF4E5",
              border: "1px solid #FFD8A8",
              borderRadius: 8,
              color: "#9A5B13",
              fontSize: 12.5,
              lineHeight: 1.5,
              marginBottom: 12
            }}
          >
            {error}
          </div>
        )}

        {passNote && (
          <div style={{ fontSize: 11.5, color: C.inkMute, marginBottom: 10, lineHeight: 1.5 }}>{passNote}</div>
        )}

        <ArticleWriter
          topic={topic}
          pillar={pillar}
          channel={channel}
          voiceSamples={voiceSamples}
          seed={seed}
          onPassNote={setPassNote}
          onError={setError}
        />
      </div>
    </AppShell>
  );
}
