// The Slide renderer — ported verbatim from kognoz-social-studio-v3.jsx
// (lines ~38-51 for the render helpers, ~82-727 for Petal/ImageSlot/Slide).
// Draws a single slide at full resolution (baseW x baseH). This was the
// single largest blocked piece — everything else (Studio editor, export
// pipeline, verify) renders through this component.
"use client";

import React, { useRef } from "react";
import { C, GRAD, GRAD_DARK, FONT, DISPLAY_FONT, GLASS_DARKBG, GLASS_LIGHTBG } from "@/lib/tokens";
import { DESIGN_SETS, isDarkRegister, type DesignSetId } from "@/lib/designSets";
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
  const cardGlass = isDarkRegister(dz.set, seed);
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
    // Dark register. The stash of cards is the whole idea here, so the stack keeps
    // its geometry and only the palette moves.
    if (cardGlass) {
      return (
        <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
          {dz.petals && <Petal w={620} o={0.5} style={{ position: "absolute", top: -170, right: -180 }} />}
          <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
            <Eyebrow dark />
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <div style={{ position: "absolute", width: "86%", height: "60%", borderRadius: 28, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", transform: "rotate(4deg) translateY(16px)" }} />
              <div style={{ position: "absolute", width: "91%", height: "62%", borderRadius: 28, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)", transform: "rotate(-2.5deg) translateY(7px)" }} />
              <div style={{ position: "relative", width: "96%", borderRadius: 28, padding: "84px 64px", ...GLASS_DARKBG, boxShadow: "0 28px 70px rgba(0,20,40,0.4)", textAlign: "center" }}>
                <div style={{ fontFamily: font, fontSize: sz(20), fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: accentOnDark, marginBottom: 26 }}>{total} ideas · swipe</div>
                <h1 style={{ fontFamily: displayFont, fontSize: fit(76, cover, 46), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.015em", color: "#fff", margin: 0 }}>{renderEm(cover)}</h1>
              </div>
            </div>
          </div>
          <Foot dark right={COVER_R} />
        </div>
      );
    }
    return (
      <div id={id} style={{ ...wrap, background: C.off }}>
        {dz.petals && <Petal w={620} o={0.7} style={{ position: "absolute", top: -170, right: -180 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ position: "absolute", width: "86%", height: "60%", borderRadius: 28, background: C.white, border: `1px solid ${C.lineD}`, transform: "rotate(4deg) translateY(16px)", opacity: 0.5 }} />
            <div style={{ position: "absolute", width: "91%", height: "62%", borderRadius: 28, background: C.white, border: `1px solid ${C.lineD}`, transform: "rotate(-2.5deg) translateY(7px)", opacity: 0.75 }} />
            <div style={{ position: "relative", width: "96%", borderRadius: 28, padding: "84px 64px", background: C.white, border: `1px solid ${C.line}`, boxShadow: "0 28px 70px rgba(0,40,70,0.12)", textAlign: "center" }}>
              <div style={{ fontFamily: font, fontSize: sz(20), fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: accent, marginBottom: 26 }}>{total} ideas · swipe</div>
              <h1 style={{ fontFamily: displayFont, fontSize: fit(76, cover, 46), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.015em", color: C.ink, margin: 0 }}>{renderEm(cover)}</h1>
            </div>
          </div>
        </div>
        <Foot right={COVER_R} />
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
      // `darkCard` is per-card (Ask / Kognoz-read always read dark). `cardGlass` is
      // the deck-wide register from the design set. On the dark register the page
      // turns and the ordinary cards become glass; the already-dark cards stay put.
      <div id={id} style={{ ...wrap, background: cardGlass ? GRAD_DARK : C.off }}>
        {dz.petals && <Petal w={380} o={cardGlass ? 0.32 : 0.4} style={{ position: "absolute", top: -110, right: -110 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow dark={cardGlass} n={nn} />
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: "100%",
                borderRadius: 28,
                padding: "76px 64px",
                ...(darkCard
                  ? { background: GRAD_DARK, border: "none" }
                  : cardGlass
                  ? { ...GLASS_DARKBG, border: `1px solid ${isReveal ? C.teal : "rgba(255,255,255,0.18)"}` }
                  : { background: C.white, border: `1px solid ${isReveal ? C.teal : C.line}` }),
                boxShadow: cardGlass || darkCard ? "0 24px 60px rgba(0,20,40,0.35)" : "0 24px 60px rgba(0,40,70,0.10)",
                textAlign: "center",
                position: "relative",
                overflow: "hidden"
              }}
            >
              {darkCard && dz.petals && <Petal w={300} o={0.4} style={{ position: "absolute", bottom: -90, right: -90 }} />}
              <div style={{ fontFamily: font, fontSize: sz(20), fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: darkCard ? C.green : isReveal ? C.teal : cardGlass ? accentOnDark : accent, marginBottom: 30, position: "relative" }}>
                {kick}
              </div>
              <div style={{ fontFamily: displayFont, fontSize: fit(58, data.body, 95), fontWeight: 600, lineHeight: 1.22, letterSpacing: "-0.01em", color: darkCard || cardGlass ? "#fff" : C.ink, position: "relative" }}>
                {renderLines(data.body)}
              </div>
              {isAsk && <div style={{ fontFamily: font, fontSize: sz(21), color: "rgba(255,255,255,0.65)", marginTop: 34, position: "relative" }}>The answer is on the next card</div>}
            </div>
          </div>
        </div>
        <Foot dark={cardGlass} right={CONTENT_R} />
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
    if (cardGlass) {
      return (
        <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
          {dz.petals && <Petal w={620} o={0.55} style={{ position: "absolute", top: -200, right: -200 }} />}
          <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
            <Eyebrow dark />
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div style={{ ...GLASS_DARKBG, width: "100%", borderRadius: 28, padding: "70px 60px", textAlign: "center" }}>
                <div style={{ fontFamily: displayFont, fontSize: fit(220, s0.title, 8), fontWeight: 600, lineHeight: 0.95, letterSpacing: "-0.02em", color: "#fff", paddingBottom: "0.1em" }}>{s0.title}</div>
                <p style={{ fontFamily: font, fontSize: fit(38, s0.body, 150), lineHeight: 1.5, color: "rgba(255,255,255,0.88)", fontWeight: 600, margin: 0 }}>{renderLines(s0.body)}</p>
              </div>
            </div>
          </div>
          <Foot dark right={SINGLE_R} />
        </div>
      );
    }
    return (
      <div id={id} style={{ ...wrap, background: C.off }}>
        {dz.petals && <Petal w={560} o={0.5} style={{ position: "absolute", bottom: -170, right: -170 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div
              style={{
                fontFamily: displayFont,
                fontSize: fit(240, s0.title, 8),
                fontWeight: 600,
                lineHeight: 0.95,
                letterSpacing: "-0.02em",
                background: GRAD,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                paddingBottom: "0.12em",
                marginBottom: "-0.02em"
              }}
            >
              {s0.title}
            </div>
            <p style={{ fontFamily: font, fontSize: fit(40, s0.body, 150), lineHeight: 1.5, color: C.ink, fontWeight: 600, margin: 0, maxWidth: 820 }}>{renderLines(s0.body)}</p>
          </div>
        </div>
        <Foot right={SINGLE_R} />
      </div>
    );
  }

  /* ============================ SAYS VS DOES ============================ */
  if (kind === "split") {
    const L = slides[0] || { title: "What the survey says", body: "" };
    const Rt = slides[1] || { title: "What behavior says", body: "" };
    // Dark register. The format's whole argument is the contrast between what is
    // said and what is done, so the two halves stay clearly distinct here too:
    // the claim recedes into muted glass, the behaviour sits forward and lit.
    if (cardGlass) {
      return (
        <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "72px 96px 44px" }}>
              <Eyebrow dark />
              <h1 style={{ fontFamily: displayFont, fontSize: fit(64, cover, 58), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.01em", color: "#fff", margin: "24px 0 0" }}>{renderEm(cover)}</h1>
            </div>
            <div style={{ flex: 1, display: "flex" }}>
              {/* The claim is pushed back: darker than the page, muted type. */}
              <div style={{ flex: 1, background: "rgba(0,20,40,0.42)", padding: "58px 60px", display: "flex", flexDirection: "column" }}>
                <div style={{ fontFamily: font, fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)", marginBottom: 30 }}>{L.title}</div>
                <p style={{ fontFamily: displayFont, fontSize: sz(45), lineHeight: 1.28, color: "rgba(255,255,255,0.55)", margin: 0, fontStyle: "italic" }}>&ldquo;{renderLines(L.body)}&rdquo;</p>
              </div>
              {/* The behaviour comes forward: lifted panel, green rule, full-white type.
                  The light register gets this separation from pale-vs-dark; on dark the
                  step has to be built deliberately or the format loses its argument. */}
              <div style={{ flex: 1, background: "rgba(255,255,255,0.14)", borderLeft: `4px solid ${C.green}`, borderRadius: 0, padding: "58px 60px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
                {dz.petals && <Petal w={340} o={0.42} style={{ position: "absolute", bottom: -100, right: -100 }} />}
                <div style={{ fontFamily: font, fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.green, marginBottom: 30, position: "relative" }}>{Rt.title}</div>
                <p style={{ fontFamily: displayFont, fontSize: sz(45), lineHeight: 1.28, color: "#fff", margin: 0, position: "relative" }}>{Rt.body}</p>
              </div>
            </div>
            <div style={{ padding: "36px 96px 84px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.14)" }}>
              <Logo h={64} white />
              <div style={{ fontFamily: font, fontSize: 22, color: "rgba(255,255,255,0.6)" }}>{SINGLE_R}</div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div id={id} style={{ ...wrap, background: C.white }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "72px 96px 44px" }}>
            <Eyebrow />
            <h1 style={{ fontFamily: displayFont, fontSize: fit(64, cover, 58), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.01em", color: C.ink, margin: "24px 0 0" }}>{renderEm(cover)}</h1>
          </div>
          <div style={{ flex: 1, display: "flex" }}>
            <div style={{ flex: 1, background: C.mist, padding: "58px 60px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: font, fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.inkMute, marginBottom: 30 }}>{L.title}</div>
              <p style={{ fontFamily: displayFont, fontSize: sz(45), lineHeight: 1.28, color: C.inkSoft, margin: 0, fontStyle: "italic" }}>&ldquo;{renderLines(L.body)}&rdquo;</p>
            </div>
            <div style={{ flex: 1, background: GRAD_DARK, padding: "58px 60px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
              {dz.petals && <Petal w={340} o={0.42} style={{ position: "absolute", bottom: -100, right: -100 }} />}
              <div style={{ fontFamily: font, fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.green, marginBottom: 30, position: "relative" }}>{Rt.title}</div>
              <p style={{ fontFamily: displayFont, fontSize: sz(45), lineHeight: 1.28, color: "#fff", margin: 0, position: "relative" }}>{Rt.body}</p>
            </div>
          </div>
          <div style={{ padding: "36px 96px 84px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${C.line}` }}>
            <Logo h={64} />
            <div style={{ fontFamily: font, fontSize: 22, color: C.inkMute }}>{SINGLE_R}</div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================== DIALOGUE ============================== */
  if (kind === "dialogue") {
    if (cardGlass) {
      return (
        <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
          {dz.petals && <Petal w={520} o={0.5} style={{ position: "absolute", top: -160, right: -160 }} />}
          <div style={{ position: "absolute", inset: 0, padding: "80px 96px 190px", display: "flex", flexDirection: "column" }}>
            <Eyebrow dark />
            <h1 style={{ fontFamily: displayFont, fontSize: fit(56, cover, 62), fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: "#fff", margin: "22px 0 50px" }}>{renderEm(cover)}</h1>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 28 }}>
              {slides.map((m, i) => {
                const isK = /kognoz/i.test(m.title);
                return (
                  <div key={i} style={{ display: "flex", justifyContent: isK ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "78%" }}>
                      <div
                        style={{
                          fontFamily: font,
                          fontSize: 20,
                          fontWeight: 700,
                          color: isK ? C.green : "rgba(255,255,255,0.55)",
                          marginBottom: 8,
                          textAlign: isK ? "right" : "left",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase"
                        }}
                      >
                        {m.title}
                      </div>
                      <div
                        style={{
                          ...GLASS_DARKBG,
                          fontFamily: font,
                          fontSize: sz(32),
                          lineHeight: 1.45,
                          padding: "26px 32px",
                          borderRadius: isK ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
                          color: "#fff"
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
          <Foot dark right={SINGLE_R} />
        </div>
      );
    }
    return (
      <div id={id} style={{ ...wrap, background: C.off }}>
        {dz.petals && <Petal w={460} o={0.4} style={{ position: "absolute", top: -140, right: -140 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "80px 96px 190px", display: "flex", flexDirection: "column" }}>
          <Eyebrow />
          <h1 style={{ fontFamily: displayFont, fontSize: fit(56, cover, 62), fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: C.ink, margin: "22px 0 50px" }}>{renderEm(cover)}</h1>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 28 }}>
            {slides.map((m, i) => {
              const isK = /kognoz/i.test(m.title);
              return (
                <div key={i} style={{ display: "flex", justifyContent: isK ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "78%" }}>
                    <div
                      style={{
                        fontFamily: font,
                        fontSize: 20,
                        fontWeight: 700,
                        color: isK ? C.blue : C.inkMute,
                        marginBottom: 8,
                        textAlign: isK ? "right" : "left",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase"
                      }}
                    >
                      {m.title}
                    </div>
                    <div
                      style={{
                        fontFamily: font,
                        fontSize: sz(32),
                        lineHeight: 1.45,
                        padding: "26px 32px",
                        borderRadius: isK ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
                        background: isK ? GRAD_DARK : C.white,
                        color: isK ? "#fff" : C.ink,
                        border: isK ? "none" : `1px solid ${C.line}`,
                        boxShadow: "0 6px 24px rgba(0,40,70,0.06)"
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
        <Foot right={SINGLE_R} />
      </div>
    );
  }

  /* ========================= MONTAGE (3-frame panorama) ========================= */
  if (kind === "montage") {
    const pts = [slides[0] || { title: "", body: "" }, slides[1] || { title: "", body: "" }, slides[2] || { title: "", body: "" }];
    // Dark register, mirroring the stat card: same layout, boardroom palette.
    if (cardGlass) {
      return (
        <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
          {dz.petals && <Petal w={760} o={0.4} style={{ position: "absolute", top: -260, left: 780 }} />}
          {dz.petals && <Petal w={680} o={0.32} style={{ position: "absolute", bottom: -260, left: 2040 }} />}
          <div style={{ position: "absolute", inset: 0, padding: "88px 100px", display: "flex", flexDirection: "column" }}>
            <Eyebrow dark />
            <h1 style={{ fontFamily: displayFont, fontSize: fit(154, cover, 62), fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.015em", color: "#fff", margin: "30px 0 0", maxWidth: 3000 }}>{renderEm(cover)}</h1>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 120 }}>
              {pts.map((p, i) => (
                <div key={i} style={{ flex: 1, maxWidth: 900, ...GLASS_DARKBG, borderRadius: 22, padding: "44px 46px" }}>
                  <div style={{ fontFamily: font, fontSize: 24, fontWeight: 700, letterSpacing: "0.14em", color: [C.cyan, C.teal, C.green][i], marginBottom: 14 }}>{String(i + 1).padStart(2, "0")}</div>
                  <div style={{ fontFamily: font, fontSize: sz(31), fontWeight: 800, color: "#fff", marginBottom: 12 }}>{p.title}</div>
                  <p style={{ fontFamily: font, fontSize: sz(27), lineHeight: 1.5, color: "rgba(255,255,255,0.85)", margin: 0 }}>{p.body}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 64 }}>
              <div style={{ fontFamily: font, fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{plain(cta)}</div>
              <Logo h={72} white />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div id={id} style={{ ...wrap, background: C.off }}>
        {dz.petals && <Petal w={760} o={0.5} style={{ position: "absolute", top: -260, left: 780 }} />}
        {dz.petals && <Petal w={680} o={0.4} style={{ position: "absolute", bottom: -260, left: 2040 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "88px 100px", display: "flex", flexDirection: "column" }}>
          <Eyebrow />
          <h1 style={{ fontFamily: displayFont, fontSize: fit(154, cover, 62), fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.015em", color: C.ink, margin: "30px 0 0", maxWidth: 3000 }}>{renderEm(cover)}</h1>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 120 }}>
            {pts.map((p, i) => (
              <div key={i} style={{ flex: 1, maxWidth: 900 }}>
                <div style={{ fontFamily: font, fontSize: 24, fontWeight: 700, letterSpacing: "0.14em", color: [C.cyan, C.teal, C.green][i], marginBottom: 14 }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ fontFamily: font, fontSize: sz(31), fontWeight: 800, color: C.ink, marginBottom: 12 }}>{p.title}</div>
                <p style={{ fontFamily: font, fontSize: sz(27), lineHeight: 1.5, color: C.inkSoft, margin: 0 }}>{p.body}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 64 }}>
            <div style={{ fontFamily: font, fontSize: 24, fontWeight: 700, color: C.inkMute }}>{plain(cta)}</div>
            <Logo h={72} />
          </div>
        </div>
      </div>
    );
  }

  /* ============================ STORY (9:16 vertical) ============================ */
  if (kind === "story") {
    const s0 = slides[0] || { title: "", body: "" };
    if (images.story) {
      return (
        <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
          <img src={images.story} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,30,55,0.35) 0%, rgba(0,30,55,0.1) 35%, rgba(0,30,55,0.65) 100%)" }} />
          <div style={{ position: "absolute", top: 112, left: 96, right: 96 }}>
            <Eyebrow dark />
          </div>
          <div style={{ position: "absolute", left: 84, right: 84, bottom: 210, ...GLASS_DARKBG, borderRadius: 26, padding: "52px 54px" }}>
            <h1 style={{ fontFamily: displayFont, fontSize: fit(74, cover, 42), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.015em", color: "#fff", margin: "0 0 22px" }}>{renderEm(cover)}</h1>
            <p style={{ fontFamily: font, fontSize: fit(33, s0.body, 180), lineHeight: 1.5, color: "rgba(255,255,255,0.9)", margin: 0 }}>{renderLines(s0.body)}</p>
          </div>
          <Foot dark right={SINGLE_R} />
        </div>
      );
    }
    // Story ships dark, so its second register is the light one — same layout,
    // editorial palette, matching the light stat card.
    if (!cardGlass) {
      return (
        <div id={id} style={{ ...wrap, background: C.off }}>
          {dz.petals && <Petal w={560} o={0.5} style={{ position: "absolute", top: -180, right: -190 }} />}
          <div style={{ position: "absolute", inset: 0, padding: "112px 96px 196px", display: "flex", flexDirection: "column" }}>
            <Eyebrow />
            <h1 style={{ fontFamily: displayFont, fontSize: fit(90, cover, 42), fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.015em", color: C.ink, margin: "36px 0 44px" }}>{renderEm(cover)}</h1>
            <ImageSlot img={images.story} onPick={(u) => setImg("story", u)} label="Add photo" style={{ height: 560, borderRadius: 24 }} />
            <p style={{ fontFamily: font, fontSize: sz(37), lineHeight: 1.55, color: C.inkSoft, margin: "44px 0 0", flex: 1 }}>{renderLines(s0.body)}</p>
          </div>
          <Foot right={SINGLE_R} />
        </div>
      );
    }
    return (
      <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
        {dz.petals && <Petal w={560} o={0.45} style={{ position: "absolute", top: -180, right: -190 }} />}
        <div style={{ position: "absolute", inset: 0, padding: "112px 96px 196px", display: "flex", flexDirection: "column" }}>
          <Eyebrow dark />
          <h1 style={{ fontFamily: displayFont, fontSize: fit(90, cover, 42), fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.015em", color: "#fff", margin: "36px 0 44px" }}>{renderEm(cover)}</h1>
          <ImageSlot dark img={images.story} onPick={(u) => setImg("story", u)} label="Add photo" style={{ height: 560, borderRadius: 24 }} />
          <p style={{ fontFamily: font, fontSize: sz(37), lineHeight: 1.55, color: "rgba(255,255,255,0.85)", margin: "44px 0 0", flex: 1 }}>{renderLines(s0.body)}</p>
        </div>
        <Foot dark right={SINGLE_R} />
      </div>
    );
  }

  /* ========================== VIDEO (kinetic, animated) ========================== */
  if (kind === "video") {
    const s0 = slides[0] || { title: "", body: "" };
    const words = plainWords(cover);
    const bodyDelay = 0.7 + words.length * 0.14 + 0.4;
    return (
      <div id={id} style={{ ...wrap, background: C.off }}>
        <style>{`
          @keyframes kvRise { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes kvFade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes kvDrift { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-14px) scale(1.03); } }
        `}</style>
        <div style={{ position: "absolute", top: -170, right: -190, animation: "kvDrift 9s ease-in-out infinite" }}>{dz.petals && <Petal w={600} o={0.55} />}</div>
        <div style={{ position: "absolute", inset: 0, padding: "96px 96px 196px", display: "flex", flexDirection: "column" }}>
          <div style={{ opacity: 0, animation: "kvFade .6s ease .25s forwards" }}>
            <Eyebrow />
          </div>
          <h1 style={{ fontFamily: displayFont, fontSize: fit(94, cover, 46), fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.015em", color: C.ink, margin: "50px 0 46px" }}>
            {words.map((w, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: "0.26em",
                  opacity: 0,
                  animation: `kvRise .8s cubic-bezier(.2,.75,.2,1) ${0.7 + i * 0.14}s forwards`,
                  ...(w.em ? EM_STYLE : {})
                }}
              >
                {w.t}
              </span>
            ))}
          </h1>
          <p style={{ fontFamily: font, fontSize: sz(40), lineHeight: 1.55, color: C.inkSoft, margin: 0, flex: 1, opacity: 0, animation: `kvFade .9s ease ${bodyDelay}s forwards` }}>{renderLines(s0.body)}</p>
        </div>
        <div style={{ opacity: 0, animation: `kvFade .8s ease ${bodyDelay + 1.2}s forwards` }}>
          <Foot right={SINGLE_R} />
        </div>
      </div>
    );
  }

  /* ==================== FOUNDER VIDEO SCRIPT (shoot kit) ==================== */
  if (kind === "script") {
    // Dark register: same shoot-script layout on the boardroom palette.
    if (cardGlass) {
      return (
        <div id={id} style={{ ...wrap, background: GRAD_DARK }}>
          {dz.petals && <Petal w={520} o={0.4} style={{ position: "absolute", top: -170, right: -170 }} />}
          <div style={{ position: "absolute", inset: 0, padding: "72px 84px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
              <div style={{ fontFamily: font, fontSize: 21, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: accentOnDark }}>Founder video · shoot script</div>
              <div style={{ fontFamily: font, fontSize: 19, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{eyebrow}</div>
            </div>
            <h1 style={{ fontFamily: displayFont, fontSize: 52, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: "#fff", margin: "0 0 34px" }}>{renderEm(cover)}</h1>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
              {slides.map((b, i) => (
                <div key={i} style={{ display: "flex", gap: 22, padding: "24px 26px", ...GLASS_DARKBG, borderRadius: 14 }}>
                  <div style={{ flexShrink: 0, width: 132, fontFamily: font, fontSize: 18, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: accentOnDark, paddingTop: 4 }}>{b.title}</div>
                  <p style={{ fontFamily: font, fontSize: 27, lineHeight: 1.5, color: "rgba(255,255,255,0.92)", margin: 0 }}>{b.body}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 26, padding: "18px 26px", borderLeft: `3px solid ${accentOnDark}`, ...GLASS_DARKBG, borderRadius: "0 14px 14px 0" }}>
              <div style={{ fontFamily: font, fontSize: 17, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>Post caption</div>
              <p style={{ fontFamily: font, fontSize: 23, lineHeight: 1.45, color: "rgba(255,255,255,0.85)", margin: 0 }}>{plain(cta)}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26 }}>
              <Logo h={78} white />
              <div style={{ fontFamily: font, fontSize: 18, color: "rgba(255,255,255,0.6)" }}>60–90s · talk to camera · captions on</div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div id={id} style={{ ...wrap, background: C.white }}>
        <div style={{ position: "absolute", inset: 0, padding: "72px 84px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
            <div style={{ fontFamily: font, fontSize: 21, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: accent }}>Founder video · shoot script</div>
            <div style={{ fontFamily: font, fontSize: 19, fontWeight: 700, color: C.inkMute, letterSpacing: "0.1em", textTransform: "uppercase" }}>{eyebrow}</div>
          </div>
          <h1 style={{ fontFamily: displayFont, fontSize: 52, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: C.ink, margin: "0 0 34px" }}>{renderEm(cover)}</h1>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            {slides.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 22, padding: "24px 26px", background: C.off, borderRadius: 14 }}>
                <div style={{ flexShrink: 0, width: 132, fontFamily: font, fontSize: 18, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, paddingTop: 4 }}>{b.title}</div>
                <p style={{ fontFamily: font, fontSize: 27, lineHeight: 1.5, color: C.ink, margin: 0 }}>{b.body}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 26, padding: "18px 26px", borderLeft: `3px solid ${accent}`, background: C.off, borderRadius: "0 14px 14px 0" }}>
            <div style={{ fontFamily: font, fontSize: 17, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkMute, marginBottom: 8 }}>Post caption</div>
            <p style={{ fontFamily: font, fontSize: 23, lineHeight: 1.45, color: C.inkSoft, margin: 0 }}>{plain(cta)}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26 }}>
            <Logo h={78} />
            <div style={{ fontFamily: font, fontSize: 18, color: C.inkMute }}>60–90s · talk to camera · captions on</div>
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
        <Foot right={CONTENT_R} />
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
