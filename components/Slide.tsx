// The Slide renderer — ported verbatim from kognoz-social-studio-v3.jsx
// (lines ~38-51 for the render helpers, ~82-727 for Petal/ImageSlot/Slide).
// Draws a single slide at full resolution (baseW x baseH). This was the
// single largest blocked piece — everything else (Studio editor, export
// pipeline, verify) renders through this component.
"use client";

import React, { useRef } from "react";
import { C, GRAD, GRAD_DARK, FONT, DISPLAY_FONT, GLASS_DARKBG, GLASS_LIGHTBG } from "@/lib/tokens";
import { DESIGN_SETS, isDarkSurface, surfaceFor, type DesignSetId, type SurfaceId } from "@/lib/designSets";
import { plainWords, type CoercedSlide } from "@/lib/coerce";
import { Logo } from "./Logo";

const font = FONT;
const displayFont = DISPLAY_FONT;

const EM_STYLE: React.CSSProperties = {
  background: GRAD,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  display: "inline-block",
  paddingBottom: "0.12em",
  marginBottom: "-0.12em"
};

// Bodies can carry distinct statements (claim, source, capability line).
// Render each on its own line; "Source:" lines become small muted captions.
export const renderLines = (t: unknown) =>
  String(t || "")
    .split(/\n+/)
    .filter((x) => x.trim())
    .map((ln, i) => {
      const isSrc = /^source\s*[:\u2013\u2014-]/i.test(ln.trim());
      return (
        <span
          key={i}
          style={{
            display: "block",
            marginTop: i === 0 ? 0 : "0.55em",
            ...(isSrc ? { fontSize: "0.6em", opacity: 0.72, fontWeight: 600, letterSpacing: "0.04em", lineHeight: 1.4 } : {})
          }}
        >
          {ln.trim()}
        </span>
      );
    });

export const renderEm = (text: unknown) =>
  String(text || "")
    .split(/(\*[^*]+\*)/g)
    .map((part, i) =>
      part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
        <span key={i} style={EM_STYLE}>
          {part.slice(1, -1)}
        </span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );

export const plain = (text: unknown) => String(text || "").replace(/\*/g, "");

// The three-circle BloomMark / petal motif, as inline SVG (exports cleanly).
// v8 site language: the motif breathes — a slow, living scale pulse.
export function Petal({ w = 300, o = 1, style }: { w?: number; o?: number; style?: React.CSSProperties }) {
  return (
    <svg
      width={w}
      height={w}
      viewBox="0 0 220 220"
      style={{ animation: "kzBreathe 9s ease-in-out infinite", transformOrigin: "50% 50%", ...style }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g style={{ mixBlendMode: "multiply" }}>
        <circle cx="88" cy="92" r="60" fill={C.cyan} opacity={0.55 * o} />
        <circle cx="132" cy="92" r="60" fill={C.green} opacity={0.5 * o} />
        <circle cx="110" cy="128" r="60" fill={C.blue} opacity={0.42 * o} />
      </g>
    </svg>
  );
}

// Click-to-upload image slot. Shows a branded placeholder until a photo is
// dropped in; re-click to replace. Works in preview; exports whatever is set.
export function ImageSlot({
  img,
  onPick,
  style,
  label = "Add image",
  dark
}: {
  img?: string | null;
  onPick: (dataUrl: string) => void;
  style?: React.CSSProperties;
  label?: string;
  dark?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        inputRef.current && inputRef.current.click();
      }}
      style={{ position: "relative", cursor: "pointer", overflow: "hidden", background: dark ? "rgba(255,255,255,0.08)" : C.mist, ...style }}
    >
      {img ? (
        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            border: `3px dashed ${dark ? "rgba(255,255,255,0.35)" : C.lineD}`,
            borderRadius: 16
          }}
        >
          <Petal w={90} o={0.7} />
          <div style={{ fontFamily: font, fontSize: 22, fontWeight: 700, color: dark ? "rgba(255,255,255,0.7)" : C.inkMute }}>{label}</div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const fl = e.target.files && e.target.files[0];
          if (!fl) return;
          const r = new FileReader();
          r.onload = () => onPick(r.result as string);
          r.readAsDataURL(fl);
        }}
      />
    </div>
  );
}

export type SlideKind = "cover" | "content" | "end" | "article" | "stat" | "split" | "dialogue" | "montage" | "story" | "video" | "script";

export interface SlideDesign {
  url?: string;
  coverRight?: "swipe" | "url" | "none";
  contentRight?: "page" | "url" | "none";
  singleRight?: "cta" | "url" | "none";
  petals?: boolean;
  set?: DesignSetId;
  accent?: string | null;
}

export interface SlideProps {
  kind: SlideKind;
  data: CoercedSlide;
  accent: string;
  eyebrow: string;
  cta: string;
  baseW: number;
  baseH: number;
  idx: number;
  total: number;
  id: string;
  cover: string;
  slides: CoercedSlide[];
  seed?: number;
  images?: Record<string, string | null | undefined>;
  setImg?: (key: string, url: string) => void;
  design?: SlideDesign;
  scale?: number;
  ideaMode?: boolean;
  photoOn?: boolean;
}

export const Slide = React.memo(function Slide({
  kind,
  data,
  accent,
  eyebrow,
  cta,
  baseW,
  baseH,
  idx,
  total,
  id,
  cover,
  slides,
  seed = 0,
  images = {},
  setImg = () => {},
  design = {},
  scale = 1,
  ideaMode = false,
  photoOn = false
}: SlideProps) {
  const wrap: React.CSSProperties = { position: "relative", width: baseW, height: baseH, overflow: "hidden", fontFamily: font, boxSizing: "border-box" };
  const dz: Required<SlideDesign> = {
    url: "kognozconsulting.com",
    coverRight: "swipe",
    contentRight: "page",
    singleRight: "cta",
    petals: true,
    set: "editorial",
    accent: null,
    ...design
  };
  const CONTENT_ORDER = [0, 1, 2, 4, 5, 6, 7, 8];
  const dset = DESIGN_SETS[dz.set] || DESIGN_SETS.editorial;
  const variant =
    kind === "cover"
      ? photoOn
        ? 99
        : dset.cover === null
        ? seed % 4
        : dset.cover
      : kind === "article"
      ? seed % 3
      : kind === "content"
      ? photoOn && !ideaMode
        ? 99
        : dset.contents === null
        ? CONTENT_ORDER[(idx + seed) % CONTENT_ORDER.length]
        : dset.contents[(idx + seed) % dset.contents.length]
      : 0;
  // One surface per design set, so all six sets look different on the single-asset
  // formats instead of collapsing into "light" and "dark". Concrete values live
  // here with the renderer; lib/designSets only names them.
  const surfaceId = surfaceFor(dz.set, seed);
  const onDark = isDarkSurface(surfaceId);
  const SURFACES: Record<SurfaceId, {
    page: string; panel: React.CSSProperties; heading: string; body: string; label: string; rule: string; petal: number;
  }> = {
    paper: {
      page: C.off,
      panel: { background: C.white, border: `1px solid ${C.line}` },
      heading: C.ink, body: C.inkSoft, label: C.inkMute, rule: C.line, petal: 0.5
    },
    ivory: {
      page: C.white,
      panel: { background: C.mist, border: "none" },
      heading: C.ink, body: C.inkSoft, label: C.inkMute, rule: C.mist, petal: 0.34
    },
    boardroom: {
      page: GRAD_DARK,
      panel: { ...GLASS_DARKBG },
      heading: "#fff", body: "rgba(255,255,255,0.85)", label: "rgba(255,255,255,0.55)", rule: "rgba(255,255,255,0.14)", petal: 0.42
    },
    glass: {
      page: GRAD_DARK,
      panel: { background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.28)", backdropFilter: "blur(8px)" },
      heading: "#fff", body: "rgba(255,255,255,0.92)", label: "rgba(255,255,255,0.7)", rule: "rgba(255,255,255,0.24)", petal: 0.6
    },
    bloom: {
      page: C.mist,
      panel: { background: C.white, border: "none", boxShadow: "0 18px 44px rgba(0,40,70,0.07)" },
      heading: C.ink, body: C.inkSoft, label: C.inkMute, rule: "transparent", petal: 0.7
    },
    press: {
      page: C.off,
      panel: { background: C.white, border: "none", borderTop: `6px solid ${C.ink}` },
      heading: C.ink, body: C.inkSoft, label: C.ink, rule: C.ink, petal: 0.22
    }
  };
  const S = SURFACES[surfaceId];
  // `press` states itself with a 6px top rule. That is a page-level device: repeated
  // down a stack of chat bubbles or script beats it adds real height to a canvas that
  // cannot scroll, and reads as noise. Flatten it to a hairline for repeated items.
  const stackPanel: React.CSSProperties =
    surfaceId === "press" ? { background: C.white, border: "none", borderTop: `2px solid ${C.line}` } : S.panel;
  // GRAD_DARK is built from C.blue, so an accent of blue is invisible on a dark
  // register — label and background are the same colour. The lighter tones read
  // fine as-is. Mirrors what <Eyebrow dark> already does at the top of this file.
  const accentOnDark = !accent || accent === C.blue ? C.cyan : accent;

  // Site-language eyebrow: small, letterspaced, uppercase. No bars, no capsules.
  const Eyebrow = ({ dark, n }: { dark?: boolean; n?: string }) => (
    <div style={{ fontFamily: font, fontSize: 24, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: dark ? "rgba(255,255,255,0.75)" : accent }}>
      {n && (
        <span style={{ color: dark ? "rgba(255,255,255,0.35)" : C.lineD, marginRight: 16 }}>
          {n}
        </span>
      )}
      {eyebrow}
    </div>
  );

  // Fixed footer: identical position and logo size on every card slide, so the
  // brand never moves as people swipe.
  const Foot = ({ dark, right }: { dark?: boolean; right?: string | null }) => (
    <div style={{ position: "absolute", left: 96, right: 96, bottom: 84, display: "flex", alignItems: "center", justifyContent: "space-between", pointerEvents: "none" }}>
      <Logo h={64} white={dark} />
      {right ? <div style={{ fontFamily: font, fontSize: 22, color: dark ? "rgba(255,255,255,0.65)" : C.inkMute }}>{right}</div> : <span />}
    </div>
  );

  const PAGE = `${String(idx).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const nn = `${String(idx).padStart(2, "0")}`;
  const COVER_R = dz.coverRight === "swipe" ? "Swipe" : dz.coverRight === "url" ? dz.url : null;
  const CONTENT_R = dz.contentRight === "page" ? PAGE : dz.contentRight === "url" ? dz.url : null;
  const SINGLE_R = dz.singleRight === "cta" ? plain(cta) : dz.singleRight === "url" ? dz.url : null;

  // Auto-fit: long text shrinks gracefully instead of overflowing the layout.
  const fit = (base: number, text: unknown, comfy: number) => {
    const L = String(text || "").replace(/\*/g, "").length;
    const v = L <= comfy ? base : Math.max(Math.round((base * comfy) / L), Math.round(base * 0.58));
    return Math.round(v * scale);
  };
  const sz = (n: number) => Math.round(n * scale); // per-slide content size control

  /* ==================== IDEA DECK (Deepstash-style stash cards) ==================== */
  if (ideaMode && kind === "cover") {
    // The stash of cards IS the format, so the geometry is fixed and only the
    // surface moves. The two ghost cards behind sit at reduced opacity of the panel.
    const ghost: React.CSSProperties = onDark
      ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)" }
      : { background: C.white, border: `1px solid ${C.lineD}` };
    return (
      <div id={id} style={{ ...wrap, background: S.page }}>
        {dz.petals && <Petal w={620} o={S.petal} style={{ position: "absolute", top: -170, right: -180 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow dark={onDark} />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ position: "absolute", width: "86%", height: "60%", borderRadius: surfaceId === "press" ? 0 : 28, ...ghost, transform: "rotate(4deg) translateY(16px)", opacity: onDark ? 1 : 0.5 }} />
            <div style={{ position: "absolute", width: "91%", height: "62%", borderRadius: surfaceId === "press" ? 0 : 28, ...ghost, transform: "rotate(-2.5deg) translateY(7px)", opacity: onDark ? 1 : 0.75 }} />
            <div style={{ position: "relative", width: "96%", borderRadius: surfaceId === "press" ? 0 : 28, padding: "84px 64px", ...S.panel, boxShadow: onDark ? "0 28px 70px rgba(0,20,40,0.4)" : "0 28px 70px rgba(0,40,70,0.12)", textAlign: "center" }}>
              <div style={{ fontFamily: font, fontSize: sz(20), fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: onDark ? accentOnDark : accent, marginBottom: 26 }}>{total} ideas · swipe</div>
              <h1 style={{ fontFamily: displayFont, fontSize: fit(76, cover, 46), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.015em", color: S.heading, margin: 0 }}>{renderEm(cover)}</h1>
            </div>
          </div>
        </div>
        <Foot dark={onDark} right={COVER_R} />
      </div>
    );
  }
  if (ideaMode && kind === "content") {
    const kick = String(data.title || "");
    const isAsk = /^ask\b/i.test(kick);
    const isReveal = /^reveal\b/i.test(kick);
    const isKRead = /^the kognoz read/i.test(kick);
    const darkCard = isAsk || isKRead;
    return (
      // `darkCard` is per-card: Ask and Kognoz-read cards always read dark, on every
      // surface, because that contrast is what makes the reveal work. Everything
      // else follows the surface.
      <div id={id} style={{ ...wrap, background: S.page }}>
        {dz.petals && <Petal w={380} o={S.petal * 0.8} style={{ position: "absolute", top: -110, right: -110 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow dark={onDark} n={nn} />
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: "100%",
                borderRadius: 28,
                padding: "76px 64px",
                ...(darkCard
                  ? { background: GRAD_DARK, border: "none" }
                  : { ...S.panel, ...(isReveal ? { border: `1px solid ${C.teal}` } : {}) }),
                boxShadow: onDark || darkCard ? "0 24px 60px rgba(0,20,40,0.35)" : "0 24px 60px rgba(0,40,70,0.10)",
                textAlign: "center",
                position: "relative",
                overflow: "hidden"
              }}
            >
              {darkCard && dz.petals && <Petal w={300} o={0.4} style={{ position: "absolute", bottom: -90, right: -90 }} />}
              <div style={{ fontFamily: font, fontSize: sz(20), fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: darkCard ? C.green : isReveal ? C.teal : onDark ? accentOnDark : accent, marginBottom: 30, position: "relative" }}>
                {kick}
              </div>
              <div style={{ fontFamily: displayFont, fontSize: fit(58, data.body, 95), fontWeight: 600, lineHeight: 1.22, letterSpacing: "-0.01em", color: darkCard ? "#fff" : S.heading, position: "relative" }}>
                {renderLines(data.body)}
              </div>
              {isAsk && <div style={{ fontFamily: font, fontSize: sz(21), color: "rgba(255,255,255,0.65)", marginTop: 34, position: "relative" }}>The answer is on the next card</div>}
            </div>
          </div>
        </div>
        <Foot dark={onDark} right={CONTENT_R} />
      </div>
    );
  }

  /* ============================ COVER (3 designs) ============================ */
  if (kind === "cover") {
    if (variant === 1) {
      return (
        <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
          {dz.petals && <Petal w={720} o={0.55} style={{ position: "absolute", bottom: -220, left: -200 }} />}
          <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
            <Eyebrow dark />
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <h1 style={{ fontFamily: displayFont, fontSize: fit(100, cover, 44), fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.015em", color: "#fff", margin: 0, maxWidth: 880 }}>{renderEm(cover)}</h1>
            </div>
          </div>
          <Foot dark right={COVER_R} />
        </div>
      );
    }
    if (variant === 99) {
      return (
        <div id={id} style={{ ...wrap, background: C.white }}>
          <ImageSlot img={images.cover} onPick={(u) => setImg("cover", u)} label="Add cover photo" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "52%" }} />
          <div style={{ position: "absolute", top: "52%", left: 0, right: 0, bottom: 0, padding: "56px 96px 180px", display: "flex", flexDirection: "column" }}>
            <Eyebrow />
            <h1 style={{ fontFamily: displayFont, fontSize: fit(66, cover, 56), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.01em", color: C.ink, margin: "26px 0 0", flex: 1 }}>{renderEm(cover)}</h1>
          </div>
          <Foot right={COVER_R} />
        </div>
      );
    }
    if (variant === 2) {
      // Bloom hero: the motif carries the slide, v8 homepage-hero style.
      return (
        <div id={id} style={{ ...wrap, background: C.off }}>
          {dz.petals && <Petal w={880} o={0.9} style={{ position: "absolute", top: "50%", right: -300, marginTop: -440 }} />}
          {dz.petals && <Petal w={360} o={0.4} style={{ position: "absolute", bottom: -120, left: -130 }} />}
          <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
            <Eyebrow />
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <h1 style={{ fontFamily: displayFont, fontSize: fit(104, cover, 40), fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.02em", color: C.ink, margin: 0, maxWidth: 760, position: "relative" }}>{renderEm(cover)}</h1>
            </div>
          </div>
          <Foot right={COVER_R} />
        </div>
      );
    }
    if (variant === 3) {
      // Glass cover: frosted panel floating on the deep gradient.
      return (
        <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
          {dz.petals && <Petal w={760} o={0.7} style={{ position: "absolute", top: -220, right: -230 }} />}
          {dz.petals && <Petal w={460} o={0.45} style={{ position: "absolute", bottom: -160, left: -150 }} />}
          <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
            <Eyebrow dark />
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div style={{ ...GLASS_DARKBG, width: "100%", borderRadius: 28, padding: "76px 64px" }}>
                <h1 style={{ fontFamily: displayFont, fontSize: fit(88, cover, 44), fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.015em", color: "#fff", margin: 0 }}>{renderEm(cover)}</h1>
              </div>
            </div>
          </div>
          <Foot dark right={COVER_R} />
        </div>
      );
    }
    return (
      <div id={id} style={{ ...wrap, background: C.off }}>
        {dz.petals && <Petal w={680} o={0.85} style={{ position: "absolute", top: -170, right: -190 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow />
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <h1 style={{ fontFamily: displayFont, fontSize: fit(100, cover, 44), fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.015em", color: C.ink, margin: 0, maxWidth: 860 }}>{renderEm(cover)}</h1>
          </div>
        </div>
        <Foot right={COVER_R} />
      </div>
    );
  }

  /* ======================== ARTICLE COVER (2 designs) ======================== */
  if (kind === "article") {
    if (variant === 1) {
      return (
        <div id={id} style={{ ...wrap, background: C.off }}>
          <div style={{ position: "absolute", inset: 0, display: "flex" }}>
            <div style={{ flex: 1.15, padding: "88px 84px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
              {dz.petals && <Petal w={380} o={0.4} style={{ position: "absolute", bottom: -110, left: -110 }} />}
              <Eyebrow />
              <h1 style={{ fontFamily: displayFont, fontSize: fit(90, cover, 50), fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.015em", color: C.ink, margin: 0, position: "relative" }}>{renderEm(cover)}</h1>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                <Logo h={78} />
                <div style={{ fontFamily: font, fontSize: 24, color: C.inkMute }}>{dz.url}</div>
              </div>
            </div>
            <ImageSlot img={images.article} onPick={(u) => setImg("article", u)} label="Add article photo" style={{ flex: 1 }} />
          </div>
        </div>
      );
    }
    if (variant === 2) {
      return (
        <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
          {dz.petals && <Petal w={980} o={0.6} style={{ position: "absolute", top: -300, right: -300 }} />}
          {dz.petals && <Petal w={520} o={0.35} style={{ position: "absolute", bottom: -180, left: -160 }} />}
          <div style={{ position: "absolute", inset: 0, padding: "88px 100px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ ...GLASS_DARKBG, borderRadius: 30, padding: "70px 80px", maxWidth: 1500 }}>
              <Eyebrow dark />
              <h1 style={{ fontFamily: displayFont, fontSize: fit(96, cover, 55), fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.015em", color: "#fff", margin: "26px 0 0" }}>{renderEm(cover)}</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 44 }}>
              <Logo h={78} white />
              <div style={{ fontFamily: font, fontSize: 26, color: "rgba(255,255,255,0.65)" }}>{dz.url}</div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
        {dz.petals && <Petal w={900} o={0.5} style={{ position: "absolute", top: -260, right: -260 }} />}
        {dz.petals && <Petal w={460} o={0.32} style={{ position: "absolute", bottom: -160, left: -140 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "88px 100px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <Eyebrow dark />
          <h1 style={{ fontFamily: displayFont, fontSize: fit(108, cover, 58), fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.015em", color: "#fff", margin: 0, maxWidth: 1460 }}>{renderEm(cover)}</h1>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Logo h={82} white />
            <div style={{ fontFamily: font, fontSize: 26, color: "rgba(255,255,255,0.65)" }}>{dz.url}</div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================== STAT CARD ============================== */
  if (kind === "stat") {
    const s0 = slides[0] || { title: "", body: "" };
    // The number is the design. On light surfaces it takes the brand gradient; on
    // dark ones it goes solid white inside a panel, which reads far better there.
    //
    // But nothing stops the title being a sentence — a Carousel claim read through
    // this format is ~36 chars, and fit(220, …, 8) bottoms out at its 58% floor and
    // bursts the card. Pick the base off length instead of assuming a figure; the
    // floor then does the right thing either way, and prose gets a lineHeight that
    // does not clip descenders.
    const figure = String(s0.title || "");
    const isFigure = figure.length <= 12;
    return (
      <div id={id} style={{ ...wrap, background: S.page }}>
        {dz.petals && <Petal w={onDark ? 620 : 560} o={S.petal} style={{ position: "absolute", ...(onDark ? { top: -200, right: -200 } : { bottom: -170, right: -170 }) }} />}
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow dark={onDark} />
          {onDark ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div style={{ ...S.panel, width: "100%", borderRadius: 28, padding: "70px 60px", textAlign: "center" }}>
                <div style={{ fontFamily: displayFont, fontSize: isFigure ? fit(220, figure, 8) : fit(88, figure, 44), fontWeight: 600, lineHeight: isFigure ? 0.95 : 1.12, letterSpacing: "-0.02em", color: "#fff", paddingBottom: "0.1em" }}>{figure}</div>
                <p style={{ fontFamily: font, fontSize: fit(38, s0.body, 150), lineHeight: 1.5, color: S.body, fontWeight: 600, margin: 0 }}>{renderLines(s0.body)}</p>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div
                style={{
                  fontFamily: displayFont,
                  fontSize: isFigure ? fit(240, figure, 8) : fit(96, figure, 44),
                  fontWeight: 600,
                  lineHeight: isFigure ? 0.95 : 1.12,
                  letterSpacing: "-0.02em",
                  ...(surfaceId === "press"
                    ? { color: C.ink }
                    : { background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }),
                  paddingBottom: "0.12em",
                  marginBottom: "-0.02em"
                }}
              >
                {figure}
              </div>
              {surfaceId === "press" && <div style={{ height: 6, background: C.ink, width: 220, margin: "0 0 30px" }} />}
              <p style={{ fontFamily: font, fontSize: fit(40, s0.body, 150), lineHeight: 1.5, color: S.heading, fontWeight: 600, margin: 0, maxWidth: 820 }}>{renderLines(s0.body)}</p>
            </div>
          )}
        </div>
        <Foot dark={onDark} right={SINGLE_R} />
      </div>
    );
  }

  /* ============================ SAYS VS DOES ============================ */
  if (kind === "split") {
    const L = slides[0] || { title: "What the survey says", body: "" };
    const Rt = slides[1] || { title: "What behavior says", body: "" };
    // The format's argument IS the contrast between the two halves, so the claim
    // always recedes and the behaviour always comes forward — on every surface.
    const claimBg = onDark ? "rgba(0,20,40,0.42)" : surfaceId === "ivory" ? C.off : C.mist;
    const claimLabel = onDark ? "rgba(255,255,255,0.42)" : C.inkMute;
    const claimBody = onDark ? "rgba(255,255,255,0.55)" : C.inkSoft;
    return (
      <div id={id} style={{ ...wrap, background: S.page }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "72px 96px 44px" }}>
            <Eyebrow dark={onDark} />
            <h1 style={{ fontFamily: displayFont, fontSize: fit(64, cover, 58), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.01em", color: S.heading, margin: "24px 0 0" }}>{renderEm(cover)}</h1>
          </div>
          <div style={{ flex: 1, display: "flex" }}>
            <div style={{ flex: 1, background: claimBg, padding: "58px 60px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: font, fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: claimLabel, marginBottom: 30 }}>{L.title}</div>
              <p style={{ fontFamily: displayFont, fontSize: fit(45, L.body, 150), lineHeight: 1.28, color: claimBody, margin: 0, fontStyle: "italic" }}>&ldquo;{renderLines(L.body)}&rdquo;</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "58px 60px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                overflow: "hidden",
                ...(onDark
                  ? { background: "rgba(255,255,255,0.14)", borderLeft: `4px solid ${C.green}` }
                  : { background: GRAD_DARK })
              }}
            >
              {dz.petals && <Petal w={340} o={0.42} style={{ position: "absolute", bottom: -100, right: -100 }} />}
              <div style={{ fontFamily: font, fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.green, marginBottom: 30, position: "relative" }}>{Rt.title}</div>
              <p style={{ fontFamily: displayFont, fontSize: fit(45, Rt.body, 150), lineHeight: 1.28, color: "#fff", margin: 0, position: "relative" }}>{Rt.body}</p>
            </div>
          </div>
          <div style={{ padding: "36px 96px 84px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${S.rule}` }}>
            <Logo h={64} white={onDark} />
            <div style={{ fontFamily: font, fontSize: 22, color: S.label }}>{SINGLE_R}</div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================== DIALOGUE ============================== */
  if (kind === "dialogue") {
    // One renderer across all six surfaces. Kognoz's turn always sits right and
    // carries the accent; the other speaker sits left and stays quieter.
    //
    // The canvas cannot scroll, and dropping the last turn would destroy the
    // exchange — the punchline is always final. So density is the only honest
    // lever: type, gap and padding shrink together as turns are added.
    const dn = Math.max(slides.length, 1);
    const d = Math.min(1, Math.max(0.5, 3.5 / dn));
    return (
      <div id={id} style={{ ...wrap, background: S.page }}>
        {dz.petals && <Petal w={onDark ? 520 : 460} o={S.petal} style={{ position: "absolute", top: -150, right: -150 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "80px 96px 190px", display: "flex", flexDirection: "column" }}>
          <Eyebrow dark={onDark} />
          <h1 style={{ fontFamily: displayFont, fontSize: fit(56, cover, 62), fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: S.heading, margin: `22px 0 ${Math.round(50 * d)}px` }}>{renderEm(cover)}</h1>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: Math.round(28 * d) }}>
            {slides.map((m, i) => {
              const isK = /kognoz/i.test(m.title);
              return (
                <div key={i} style={{ display: "flex", justifyContent: isK ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "78%" }}>
                    <div
                      style={{
                        fontFamily: font,
                        fontSize: Math.round(20 * d),
                        fontWeight: 700,
                        color: isK ? (onDark ? C.green : C.blue) : S.label,
                        marginBottom: Math.round(8 * d),
                        textAlign: isK ? "right" : "left",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase"
                      }}
                    >
                      {m.title}
                    </div>
                    <div
                      style={{
                        ...stackPanel,
                        fontFamily: font,
                        fontSize: fit(Math.round(32 * d), m.body, 110),
                        lineHeight: 1.45,
                        padding: `${Math.round(26 * d)}px ${Math.round(32 * d)}px`,
                        borderRadius: surfaceId === "press" ? (isK ? "0 0 0 0" : "0") : isK ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
                        color: S.heading
                      }}
                    >
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Foot dark={onDark} right={SINGLE_R} />
      </div>
    );
  }

  if (kind === "montage") {
    const pts = [slides[0] || { title: "", body: "" }, slides[1] || { title: "", body: "" }, slides[2] || { title: "", body: "" }];
    // One renderer, six surfaces. Previously this was two hardcoded branches, so
    // four of the six design sets produced an identical light montage.
    return (
      <div id={id} style={{ ...wrap, background: S.page }}>
        {dz.petals && <Petal w={760} o={S.petal} style={{ position: "absolute", top: -260, left: 780 }} />}
        {dz.petals && <Petal w={680} o={S.petal * 0.8} style={{ position: "absolute", bottom: -260, left: 2040 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "88px 100px", display: "flex", flexDirection: "column" }}>
          <Eyebrow dark={onDark} />
          <h1 style={{ fontFamily: displayFont, fontSize: fit(154, cover, 62), fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.015em", color: S.heading, margin: "30px 0 0", maxWidth: 3000 }}>{renderEm(cover)}</h1>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 120 }}>
            {pts.map((p, i) => (
              <div key={i} style={{ flex: 1, maxWidth: 900, ...S.panel, borderRadius: surfaceId === "press" ? 0 : 22, padding: "44px 46px" }}>
                <div style={{ fontFamily: font, fontSize: 24, fontWeight: 700, letterSpacing: "0.14em", color: [C.cyan, C.teal, C.green][i], marginBottom: 14 }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ fontFamily: font, fontSize: fit(31, p.title, 40), fontWeight: 800, color: S.heading, marginBottom: 12 }}>{p.title}</div>
                <p style={{ fontFamily: font, fontSize: fit(27, p.body, 150), lineHeight: 1.5, color: S.body, margin: 0 }}>{p.body}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 64 }}>
            <div style={{ fontFamily: font, fontSize: 24, fontWeight: 700, color: S.label }}>{plain(cta)}</div>
            <Logo h={72} white={onDark} />
          </div>
        </div>
      </div>
    );
  }

  /* ============================ STORY (9:16 vertical) ============================ */
  if (kind === "story") {
    const s0 = slides[0] || { title: "", body: "" };
    // A photo always wins the surface — the image is the design at 9:16.
    if (images.story) {
      return (
        <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
          <img src={images.story} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,30,55,0.35) 0%, rgba(0,30,55,0.1) 35%, rgba(0,30,55,0.65) 100%)" }} />
          <div style={{ position: "absolute", top: 112, left: 96, right: 96 }}>
            <Eyebrow dark />
          </div>
          {/* auto height meant long copy grew UPWARD over the eyebrow; both children
              already use fit(), so this is a backstop rather than the mechanism. */}
          <div style={{ position: "absolute", left: 84, right: 84, bottom: 210, maxHeight: baseH - 420, overflow: "hidden", ...GLASS_DARKBG, borderRadius: 26, padding: "52px 54px" }}>
            <h1 style={{ fontFamily: displayFont, fontSize: fit(74, cover, 42), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.015em", color: "#fff", margin: "0 0 22px" }}>{renderEm(cover)}</h1>
            <p style={{ fontFamily: font, fontSize: fit(33, s0.body, 180), lineHeight: 1.5, color: "rgba(255,255,255,0.9)", margin: 0 }}>{renderLines(s0.body)}</p>
          </div>
          <Foot dark right={SINGLE_R} />
        </div>
      );
    }
    return (
      <div id={id} style={{ ...wrap, background: S.page }}>
        {dz.petals && <Petal w={560} o={S.petal} style={{ position: "absolute", top: -180, right: -190 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "112px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow dark={onDark} />
          <h1 style={{ fontFamily: displayFont, fontSize: fit(90, cover, 42), fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.015em", color: S.heading, margin: "36px 0 44px" }}>{renderEm(cover)}</h1>
          <ImageSlot dark={onDark} img={images.story} onPick={(u) => setImg("story", u)} label="Add photo" style={{ height: 560, borderRadius: surfaceId === "press" ? 0 : 24 }} />
          <p style={{ fontFamily: font, fontSize: sz(37), lineHeight: 1.55, color: S.body, margin: "44px 0 0", flex: 1 }}>{renderLines(s0.body)}</p>
        </div>
        <Foot dark={onDark} right={SINGLE_R} />
      </div>
    );
  }

  /* ====================== VIDEO (kinetic headline) ====================== */
  if (kind === "video") {
    const s0 = slides[0] || { title: "", body: "" };
    const words = plainWords(cover);
    const bodyDelay = 0.7 + words.length * 0.14 + 0.4;
    // The keyframes live in app/globals.css, NOT in an inline <style> here:
    // lib/exportPipeline.ts strips <style> blocks from the cloned node, and the
    // SVG it rebuilds carries only the font CSS. Every animation below therefore
    // uses `backwards` and sets no inline opacity — with the keyframes missing at
    // export time the element renders at full opacity instead of exporting blank.
    return (
      <div id={id} style={{ ...wrap, background: S.page }}>
        <div style={{ position: "absolute", top: -170, right: -190, animation: "kvDrift 9s ease-in-out infinite" }}>
          {dz.petals && <Petal w={600} o={S.petal} />}
        </div>
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <div style={{ animation: "kvFade .6s ease .25s backwards" }}>
            <Eyebrow dark={onDark} />
          </div>
          <h1 style={{ fontFamily: displayFont, fontSize: fit(94, cover, 46), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.015em", color: S.heading, margin: "50px 0 46px" }}>
            {words.map((w, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: "0.26em",
                  animation: `kvRise .8s cubic-bezier(.2,.75,.2,1) ${0.7 + i * 0.14}s backwards`,
                  // EM_STYLE is the brand gradient clipped to text, built from
                  // C.blue — invisible on a dark page, same as the stat card.
                  ...(w.em ? (onDark ? { color: accentOnDark } : EM_STYLE) : {})
                }}
              >
                {w.t}
              </span>
            ))}
          </h1>
          <p
            style={{
              fontFamily: font,
              fontSize: fit(40, s0.body, 170),
              lineHeight: 1.55,
              color: S.body,
              margin: 0,
              flex: 1,
              animation: `kvFade .9s ease ${bodyDelay}s backwards`
            }}
          >
            {renderLines(s0.body)}
          </p>
        </div>
        <div style={{ animation: `kvFade .8s ease ${bodyDelay + 1.2}s backwards` }}>
          <Foot dark={onDark} right={SINGLE_R} />
        </div>
      </div>
    );
  }

  if (kind === "script") {
    // Shoot script: one surface-driven sheet. The accent has to survive a dark page,
    // where C.blue is the same colour as the background.
    const cue = onDark ? accentOnDark : accent;
    // A shoot script missing its closing beat is useless on set, so beats are never
    // dropped — density shrinks instead. At 5 beats the old fixed sizing needed
    // ~925px in ~824px of column, which is the reported "slide 5 not aligned".
    const bn = Math.max(slides.length, 1);
    const d = Math.min(1, Math.max(0.55, 4.5 / bn));
    return (
      <div id={id} style={{ ...wrap, background: S.page }}>
        {onDark && dz.petals && <Petal w={520} o={S.petal} style={{ position: "absolute", top: -170, right: -170 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "72px 84px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
            <div style={{ fontFamily: font, fontSize: 21, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: cue }}>Founder video · shoot script</div>
            <div style={{ fontFamily: font, fontSize: 19, fontWeight: 700, color: S.label, letterSpacing: "0.1em", textTransform: "uppercase" }}>{eyebrow}</div>
          </div>
          <h1 style={{ fontFamily: displayFont, fontSize: fit(52, cover, 60), fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: S.heading, margin: `0 0 ${Math.round(34 * d)}px` }}>{renderEm(cover)}</h1>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: Math.round(20 * d) }}>
            {slides.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 22, padding: `${Math.round(24 * d)}px 26px`, ...stackPanel, borderRadius: surfaceId === "press" ? 0 : 14 }}>
                <div style={{ flexShrink: 0, width: Math.round(132 * d) + 60, fontFamily: font, fontSize: Math.round(18 * d), fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: cue, paddingTop: 4 }}>{b.title}</div>
                {/* was a bare literal 27 — neither sz() nor the A+/A- control could reach it */}
                <p style={{ fontFamily: font, fontSize: fit(Math.round(27 * d), b.body, 110), lineHeight: 1.5, color: S.heading, margin: 0 }}>{b.body}</p>
              </div>
            ))}
          </div>
          {/* borderLeft AFTER the spread: every surface's S.panel sets the `border`
              shorthand, which resets all four sides and silently wiped this rule. */}
          <div style={{ marginTop: 26, padding: "18px 26px", ...S.panel, borderLeft: `3px solid ${cue}`, borderRadius: surfaceId === "press" ? 0 : "0 14px 14px 0" }}>
            <div style={{ fontFamily: font, fontSize: 17, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: S.label, marginBottom: 8 }}>Post caption</div>
            <p style={{ fontFamily: font, fontSize: fit(23, cta, 130), lineHeight: 1.45, color: S.body, margin: 0 }}>{plain(cta)}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26 }}>
            <Logo h={78} white={onDark} />
            <div style={{ fontFamily: font, fontSize: 18, color: S.label }}>60–90s · talk to camera · captions on</div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================ END / CLOSING ============================ */
  if (kind === "end") {
    return (
      <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
        {dz.petals && <Petal w={620} o={0.55} style={{ position: "absolute", bottom: -190, left: -170 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h2 style={{ fontFamily: displayFont, fontSize: fit(74, cta, 52), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.01em", color: "#fff", margin: 0, maxWidth: 830 }}>{renderEm(cta)}</h2>
        </div>
        <Foot dark right={dz.url} />
      </div>
    );
  }

  /* ==================== CONTENT SLIDES (rotating designs) ==================== */
  const imgKey = `s${Math.max(idx - 1, 0)}`; // keyed to the slide's position in the slides array, stable across regenerations
  if (variant === 1) {
    return (
      <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
        {dz.petals && <Petal w={420} o={0.42} style={{ position: "absolute", top: -130, right: -130 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow dark n={nn} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 860 }}>
            <h2 style={{ fontFamily: displayFont, fontSize: fit(66, data.title, 54), fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: "#fff", margin: "0 0 32px" }}>{data.title}</h2>
            <p style={{ fontFamily: font, fontSize: fit(36, data.body, 230), lineHeight: 1.55, color: "rgba(255,255,255,0.82)", margin: 0 }}>{renderLines(data.body)}</p>
          </div>
        </div>
        <Foot dark right={CONTENT_R} />
      </div>
    );
  }
  if (variant === 2) {
    return (
      <div id={id} style={{ ...wrap, background: C.mist }}>
        <div style={{ position: "absolute", top: 0, left: 34, fontFamily: displayFont, fontSize: 470, fontWeight: 600, lineHeight: 1, color: "rgba(0,81,132,0.07)", userSelect: "none" }}>{nn}</div>
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Eyebrow />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", maxWidth: 820 }}>
            <h2 style={{ fontFamily: displayFont, fontSize: fit(66, data.title, 54), fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: C.ink, margin: "0 0 30px" }}>{data.title}</h2>
            <p style={{ fontFamily: font, fontSize: fit(36, data.body, 230), lineHeight: 1.55, color: C.inkSoft, margin: 0 }}>{renderLines(data.body)}</p>
          </div>
        </div>
        <Foot dark={onDark} right={CONTENT_R} />
      </div>
    );
  }
  if (variant === 99) {
    return (
      <div id={id} style={{ ...wrap, background: C.white }}>
        <ImageSlot img={images[imgKey]} onPick={(u) => setImg(imgKey, u)} label="Add photo" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "44%" }} />
        <div style={{ position: "absolute", top: "44%", left: 0, right: 0, bottom: 0, padding: "50px 96px 180px", display: "flex", flexDirection: "column" }}>
          <Eyebrow n={nn} />
          <h2 style={{ fontFamily: displayFont, fontSize: fit(58, data.title, 56), fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: C.ink, margin: "26px 0 24px" }}>{data.title}</h2>
          <p style={{ fontFamily: font, fontSize: fit(33, data.body, 220), lineHeight: 1.5, color: C.inkSoft, margin: 0, flex: 1 }}>{renderLines(data.body)}</p>
        </div>
        <Foot right={CONTENT_R} />
      </div>
    );
  }
  if (variant === 7) {
    // Glass tile on the gradient: v8's frosted language as a content slide.
    return (
      <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
        {dz.petals && <Petal w={520} o={0.55} style={{ position: "absolute", top: -160, right: -160 }} />}
        {dz.petals && <Petal w={380} o={0.35} style={{ position: "absolute", bottom: -130, left: -120 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow dark n={nn} />
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div style={{ ...GLASS_DARKBG, width: "100%", borderRadius: 26, padding: "64px 58px" }}>
              <h2 style={{ fontFamily: displayFont, fontSize: fit(58, data.title, 52), fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: "#fff", margin: "0 0 26px" }}>{data.title}</h2>
              <p style={{ fontFamily: font, fontSize: fit(34, data.body, 230), lineHeight: 1.55, color: "rgba(255,255,255,0.85)", margin: 0 }}>{renderLines(data.body)}</p>
            </div>
          </div>
        </div>
        <Foot dark right={CONTENT_R} />
      </div>
    );
  }
  if (variant === 8) {
    // Photo-glass magazine: full-bleed image (or deep gradient when no photo
    // yet) with a frosted caption panel. Click the background to add the photo.
    const bgImg = images[imgKey];
    return (
      <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
        {bgImg ? (
          <img src={bgImg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <ImageSlot dark img={null} onPick={(u) => setImg(imgKey, u)} label="Add full-bleed photo" style={{ position: "absolute", inset: 0 }} />
        )}
        {bgImg && (
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,30,55,0.05) 40%, rgba(0,30,55,0.55) 100%)" }}
          />
        )}
        <div style={{ position: "absolute", left: 96, right: 96, bottom: 196, ...GLASS_DARKBG, borderRadius: 24, padding: "44px 48px" }}>
          <div style={{ fontFamily: font, fontSize: 21, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)", marginBottom: 16 }}>
            {nn} · {eyebrow}
          </div>
          <h2 style={{ fontFamily: displayFont, fontSize: fit(50, data.title, 52), fontWeight: 600, lineHeight: 1.12, letterSpacing: "-0.01em", color: "#fff", margin: "0 0 16px" }}>{data.title}</h2>
          <p style={{ fontFamily: font, fontSize: fit(29, data.body, 220), lineHeight: 1.5, color: "rgba(255,255,255,0.88)", margin: 0 }}>{renderLines(data.body)}</p>
        </div>
        <Foot dark right={CONTENT_R} />
      </div>
    );
  }
  if (variant === 4) {
    // Pull-quote editorial: the body speaks as a quotation.
    return (
      <div id={id} style={{ ...wrap, background: C.white }}>
        <div style={{ position: "absolute", top: -30, left: 56, fontFamily: displayFont, fontSize: 340, fontWeight: 600, lineHeight: 1, color: accent, opacity: 0.14, userSelect: "none" }}>{"\u201C"}</div>
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Eyebrow n={nn} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 850 }}>
            <p style={{ fontFamily: displayFont, fontSize: fit(52, data.body, 150), fontStyle: "italic", lineHeight: 1.3, letterSpacing: "-0.01em", color: C.ink, margin: "0 0 36px", position: "relative" }}>{renderLines(data.body)}</p>
            <div style={{ fontFamily: font, fontSize: sz(23), fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: accent }}>{data.title}</div>
          </div>
        </div>
        <Foot right={CONTENT_R} />
      </div>
    );
  }
  if (variant === 5) {
    // Framework callout: the site's thin-left-border editorial card.
    return (
      <div id={id} style={{ ...wrap, background: C.off }}>
        {dz.petals && <Petal w={340} o={0.35} style={{ position: "absolute", top: -100, right: -110 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow n={nn} />
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div style={{ width: "100%", background: C.mist, borderLeft: `6px solid ${accent}`, borderRadius: "0 22px 22px 0", padding: "64px 60px" }}>
              <h2 style={{ fontFamily: displayFont, fontSize: fit(56, data.title, 52), fontWeight: 600, lineHeight: 1.12, letterSpacing: "-0.01em", color: C.ink, margin: "0 0 26px" }}>{data.title}</h2>
              <p style={{ fontFamily: font, fontSize: fit(34, data.body, 230), lineHeight: 1.55, color: C.inkSoft, margin: 0 }}>{renderLines(data.body)}</p>
            </div>
          </div>
        </div>
        <Foot right={CONTENT_R} />
      </div>
    );
  }
  if (variant === 6) {
    // Spectrum-zone card: colored top rule + name in the tone color (v8's
    // replacement for pills on the Human-AI Work Spectrum).
    return (
      <div id={id} style={{ ...wrap, background: C.white }}>
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow n={nn} />
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div style={{ width: "100%", background: C.off, border: `1px solid ${C.line}`, borderTop: `6px solid ${accent}`, borderRadius: 20, padding: "64px 60px" }}>
              <h2 style={{ fontFamily: displayFont, fontSize: fit(56, data.title, 52), fontWeight: 600, lineHeight: 1.12, letterSpacing: "-0.01em", color: accent, margin: "0 0 26px" }}>{data.title}</h2>
              <p style={{ fontFamily: font, fontSize: fit(34, data.body, 230), lineHeight: 1.55, color: C.inkSoft, margin: 0 }}>{renderLines(data.body)}</p>
            </div>
          </div>
        </div>
        <Foot right={CONTENT_R} />
      </div>
    );
  }
  return (
    <div id={id} style={{ ...wrap, background: C.white }}>
      {dz.petals && <Petal w={320} o={0.45} style={{ position: "absolute", bottom: -80, right: -80 }} />}
      <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
        <Eyebrow n={nn} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 840 }}>
          <h2 style={{ fontFamily: displayFont, fontSize: fit(64, data.title, 54), fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: C.ink, margin: "0 0 32px" }}>{data.title}</h2>
          <p style={{ fontFamily: font, fontSize: fit(36, data.body, 230), lineHeight: 1.55, color: C.inkSoft, margin: 0 }}>{renderLines(data.body)}</p>
        </div>
      </div>
      <Foot right={CONTENT_R} />
    </div>
  );
});
