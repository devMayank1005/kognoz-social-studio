"use client";

// "Preview in feed" — what the asset looks like once it is actually posted.
//
// The artwork is the real <Slide>, not a picture of one. Slide's interior is hardcoded
// px tuned for a 1080-wide canvas (96px padding, 24px eyebrow, a 64px logo), so it
// cannot be re-rendered smaller — passing baseW={420} would give a 420px box with 96px
// padding. The only way to shrink it is the pattern the main preview already uses: a
// fixed-size box with overflow:hidden wrapping a native-size Slide under a CSS
// transform. That is also what makes the crop free: shifting the scaled node inside a
// shorter box is precisely what a platform does to your image.
//
// Only the active platform's cards are mounted. Each card is a full Slide render, so
// mounting all six placements at once would trebled the DOM for no benefit.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Slide, type SlideProps, type SlideKind } from "./Slide";
import type { CoercedSlide } from "@/lib/coerce";
import { C, FONT, DISPLAY_FONT } from "@/lib/tokens";
import { getAuthorInfo, PLATFORMS } from "./calendar/types";
import {
  PLACEMENTS,
  placementFit,
  previewAssetSize,
  captionFit,
  fitWarning,
  describeAspect,
  artworkTransform,
  frameShiftPx,
  type Placement,
  type PlatformId
} from "@/lib/socialPreview";

export interface PreviewPage {
  kind: SlideKind;
  data: CoercedSlide;
  idx: number;
  scale: number;
  photoOn: boolean;
}

/** Everything a Slide needs that does not change from page to page. */
export type SharedSlideProps = Omit<SlideProps, "id" | "kind" | "data" | "idx" | "scale" | "photoOn">;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  formatLabel: string;
  baseW: number;
  baseH: number;
  /** Montage only: the strip is posted as this many separate slides. */
  frames?: number;
  pages: PreviewPage[];
  shared: SharedSlideProps;
  caption: string;
  onCaptionChange: (v: string) => void;
  authorName?: string | null;
  authorEmail?: string | null;
}

const PLATFORM_TABS: PlatformId[] = ["LinkedIn", "Instagram", "X (Twitter)"];
const brand = (id: PlatformId) => PLATFORMS.find((p) => p.id === id) || { color: C.blue, bg: C.mist };

export function SocialPreview({
  isOpen,
  onClose,
  formatLabel,
  baseW,
  baseH,
  frames,
  pages,
  shared,
  caption,
  onCaptionChange,
  authorName,
  authorEmail
}: Props) {
  const [tab, setTab] = useState<PlatformId>("LinkedIn");
  const [page, setPage] = useState(0);
  const [showCrop, setShowCrop] = useState(false);
  const overlayArmed = useRef(false);

  // Same backdrop contract as the calendar editor: a click is delivered to the nearest
  // common ancestor of mousedown and mouseup, so a text selection dragged out of the
  // panel would otherwise count as a backdrop click and close it.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // A framed strip is posted as its frames; a deck is posted as its slides.
  const unitCount = frames && frames > 1 ? frames : pages.length;
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, unitCount - 1)));
  }, [unitCount]);

  const asset = useMemo(() => previewAssetSize(baseW, baseH, frames), [baseW, baseH, frames]);
  const author = getAuthorInfo(authorName, authorEmail);
  const placements = PLACEMENTS.filter((p) => p.platform === tab);

  if (!isOpen) return null;

  /**
   * The artwork, cropped the way `placement` would crop it.
   *
   * `frameIndex` shifts to a slice of a wide strip; the placement crop is applied on
   * top of that shift, which is why both land in one translate.
   */
  const Artwork = ({ placement, frameIndex, width }: { placement: Placement; frameIndex: number; width: number }) => {
    const fit = placementFit(asset.w, asset.h, placement);

    // The Slide element for this unit. Framed formats render the WHOLE strip and let
    // the box clip it; deck formats render the page itself.
    const pageIdx = frames && frames > 1 ? 0 : Math.min(frameIndex, pages.length - 1);
    const p = pages[pageIdx];
    if (!p) return null;
    const node = (
      <Slide
        {...shared}
        id={`feed-${placement.id}-${frameIndex}`}
        kind={p.kind}
        data={p.data}
        idx={p.idx}
        scale={p.scale}
        photoOn={p.photoOn}
      />
    );

    if (fit.mode === "letterboxed") {
      // Every pixel survives; the asset just does not fill the frame.
      const boxH = width / placement.minAspect;
      const s = Math.min(width / asset.w, boxH / asset.h);
      const shiftX = frameShiftPx(asset.w, frames, frameIndex, s);
      return (
        <div style={{ position: "relative", width, height: boxH, overflow: "hidden", background: "#000" }}>
          <div
            style={{
              position: "absolute",
              left: (width - asset.w * s) / 2,
              top: (boxH - asset.h * s) / 2,
              width: asset.w * s,
              height: asset.h * s,
              overflow: "hidden"
            }}
          >
            <div style={{ transform: `translateX(${shiftX}px) scale(${s})`, transformOrigin: "top left", width: baseW, height: baseH }}>
              {node}
            </div>
          </div>
        </div>
      );
    }

    // A deck page is already the right node, so it must NOT be shifted by frameIndex;
    // a framed format must. Both used to run through one unguarded translate here,
    // which pushed every deck page after the first clean out of its box.
    const { scale: s, offsetX, offsetY, boxH } = artworkTransform({
      assetW: asset.w,
      assetH: asset.h,
      frames,
      frameIndex,
      boxWidth: width,
      fit
    });

    // "Show what gets cropped": reveal the whole asset and dim everything the platform
    // discards, so you can see WHERE the loss falls rather than only that it happened.
    if (showCrop && fit.mode === "cropped") {
      const reveal = artworkTransform({
        assetW: asset.w,
        assetH: asset.h,
        frames,
        frameIndex,
        boxWidth: width,
        fit,
        reveal: true
      });
      const fs = reveal.scale;
      const fullH = reveal.boxH;
      return (
        <div style={{ position: "relative", width, height: fullH, overflow: "hidden", background: C.off }}>
          <div
            style={{
              transform: `translateX(${reveal.offsetX}px) scale(${fs})`,
              transformOrigin: "top left",
              width: baseW,
              height: baseH
            }}
          >
            {node}
          </div>
          {/* Dim the four discarded bands. Only two are ever non-zero. */}
          {[
            { top: 0, left: 0, right: 0, height: fit.cropTop * fullH },
            { bottom: 0, left: 0, right: 0, height: fit.cropBottom * fullH },
            { top: 0, bottom: 0, left: 0, width: fit.cropLeft * width },
            { top: 0, bottom: 0, right: 0, width: fit.cropRight * width }
          ].map((box, i) => (
            <div key={i} style={{ position: "absolute", background: "rgba(8,26,42,0.72)", ...box }} />
          ))}
          <div
            style={{
              position: "absolute",
              top: fit.cropTop * fullH,
              bottom: fit.cropBottom * fullH,
              left: fit.cropLeft * width,
              right: fit.cropRight * width,
              border: "2px solid rgba(255,255,255,0.9)",
              boxShadow: "0 0 0 1px rgba(8,26,42,0.5)",
              pointerEvents: "none"
            }}
          />
        </div>
      );
    }

    return (
      <div style={{ position: "relative", width, height: boxH, overflow: "hidden", background: C.off }}>
        <div
          style={{
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${s})`,
            transformOrigin: "top left",
            width: baseW,
            height: baseH
          }}
        >
          {node}
        </div>
        {placement.safeTop != null && (
          <>
            <SafeBand style={{ top: 0, height: placement.safeTop * boxH }} label="Profile row" />
            <SafeBand style={{ bottom: 0, height: (placement.safeBottom || 0) * boxH }} label="Reply bar" />
          </>
        )}
      </div>
    );
  };

  const Media = ({ placement, width }: { placement: Placement; width: number }) => {
    const multi = unitCount > 1;
    return (
      <div style={{ position: "relative" }}>
        <Artwork placement={placement} frameIndex={multi ? page : 0} width={width} />
        {multi && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "rgba(8,26,42,0.72)",
              color: "#fff",
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 9px",
              borderRadius: 11
            }}
          >
            {page + 1}/{unitCount}
          </div>
        )}
      </div>
    );
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(10, 30, 50, 0.55)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16
  };

  return (
    <div
      onMouseDown={(e) => {
        overlayArmed.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const both = overlayArmed.current && e.target === e.currentTarget;
        overlayArmed.current = false;
        if (both) onClose();
      }}
      style={overlayStyle}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 1060,
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,30,60,0.24)",
          border: `1px solid ${C.line}`,
          padding: "22px 26px 28px",
          boxSizing: "border-box"
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <div>
            <div style={{ fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 600, color: C.ink }}>Preview in feed</div>
            <div style={{ fontFamily: FONT, fontSize: 12.5, color: C.inkMute, marginTop: 3 }}>
              {formatLabel} · {asset.w}×{asset.h}
              {frames && frames > 1 ? ` per frame · ${frames} frames` : ""} · {describeAspect(asset.w / asset.h)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            style={{
              border: `1px solid ${C.line}`,
              background: C.off,
              color: C.inkSoft,
              width: 30,
              height: 30,
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: 15,
              lineHeight: 1,
              flexShrink: 0
            }}
          >
            ✕
          </button>
        </div>

        {/* platform tabs + controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "16px 0 18px" }}>
          {PLATFORM_TABS.map((id) => {
            const on = tab === id;
            const b = brand(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={on}
                style={{
                  fontFamily: FONT,
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: "7px 14px",
                  borderRadius: 999,
                  cursor: "pointer",
                  border: `1.5px solid ${on ? b.color : C.line}`,
                  background: on ? b.color : "transparent",
                  color: on ? "#fff" : C.inkSoft
                }}
              >
                {id === "X (Twitter)" ? "X" : id}
              </button>
            );
          })}
          <label
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontFamily: FONT,
              fontSize: 12.5,
              color: C.inkSoft,
              cursor: "pointer"
            }}
          >
            <input type="checkbox" checked={showCrop} onChange={(e) => setShowCrop(e.target.checked)} />
            Show what gets cropped
          </label>
          {unitCount > 1 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <PagerBtn onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} label="‹" />
              <span style={{ fontFamily: FONT, fontSize: 12, color: C.inkMute, minWidth: 62, textAlign: "center" }}>
                {frames && frames > 1 ? "Frame" : "Slide"} {page + 1}/{unitCount}
              </span>
              <PagerBtn onClick={() => setPage((p) => Math.min(unitCount - 1, p + 1))} disabled={page === unitCount - 1} label="›" />
            </div>
          )}
        </div>

        {/* caption */}
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkMute }}>
            Caption · shown with each platform&apos;s own cut-off
          </span>
          <textarea
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            rows={2}
            placeholder="Paste or write the caption you'll post with this…"
            style={{
              fontFamily: FONT,
              width: "100%",
              marginTop: 7,
              padding: "9px 11px",
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              fontSize: 13,
              color: C.ink,
              background: C.white,
              boxSizing: "border-box",
              outline: "none",
              resize: "vertical",
              lineHeight: 1.5
            }}
          />
        </div>

        {/* the mocks */}
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-start" }}>
          {placements.map((p) => {
            const fit = placementFit(asset.w, asset.h, p);
            const warn = fitWarning(fit, p);
            return (
              <div key={p.id} style={{ width: p.cardW, flexShrink: 0 }}>
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: C.inkMute,
                    marginBottom: 8
                  }}
                >
                  {p.label}
                </div>

                {p.id === "instagram-story" ? (
                  <StoryMock placement={p} author={author} Media={Media} />
                ) : p.id === "instagram-grid" ? (
                  <GridMock placement={p} Media={Media} />
                ) : p.platform === "LinkedIn" ? (
                  <LinkedInMock placement={p} author={author} caption={caption} Media={Media} pageCount={unitCount} />
                ) : p.platform === "Instagram" ? (
                  <InstagramMock placement={p} author={author} caption={caption} Media={Media} />
                ) : (
                  <XMock placement={p} author={author} caption={caption} Media={Media} />
                )}

                <Verdict fit={fit} warn={warn} placement={p} />
              </div>
            );
          })}
        </div>

        <p style={{ fontFamily: FONT, fontSize: 11.5, color: C.inkMute, lineHeight: 1.55, margin: "22px 0 0", maxWidth: 720 }}>
          The artwork is the real render, not a screenshot, so what you see cropped here is what gets
          cropped when you post. The accepted shapes are the ones each platform currently displays —
          they do change, and they live in one table in <code style={{ fontSize: 11 }}>lib/socialPreview.ts</code>.
          Avatars, counts and timestamps are placeholders.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type MediaFn = (props: { placement: Placement; width: number }) => JSX.Element;
type Author = ReturnType<typeof getAuthorInfo>;

function PagerBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        border: `1px solid ${C.line}`,
        background: disabled ? C.off : "#fff",
        color: disabled ? C.lineD : C.ink,
        cursor: disabled ? "default" : "pointer",
        fontSize: 14,
        lineHeight: 1
      }}
    >
      {label}
    </button>
  );
}

function SafeBand({ style, label }: { style: React.CSSProperties; label: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        background: "rgba(8,26,42,0.42)",
        borderTop: "1px dashed rgba(255,255,255,0.5)",
        borderBottom: "1px dashed rgba(255,255,255,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.9)",
        pointerEvents: "none",
        ...style
      }}
    >
      {label}
    </div>
  );
}

function Avatar({ author, size, ring }: { author: Author; size: number; ring?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: author.bg,
        color: author.color,
        fontFamily: FONT,
        fontSize: size * 0.42,
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: ring ? "0 0 0 2px #fff, 0 0 0 4px #E1306C" : undefined
      }}
    >
      {author.initial}
    </div>
  );
}

/** Caption with the platform's truncation point drawn in. */
function CaptionBlock({ caption, placement, prefix }: { caption: string; placement: Placement; prefix?: string }) {
  const c = captionFit(caption, placement);
  if (!caption.trim()) return null;
  return (
    <div style={{ fontFamily: FONT, fontSize: 12.5, lineHeight: 1.5, color: C.ink, wordBreak: "break-word" }}>
      {prefix && <strong style={{ marginRight: 5 }}>{prefix}</strong>}
      {c.shown}
      {c.truncated && (
        <>
          <span style={{ color: C.inkMute }}>… </span>
          <span style={{ color: C.inkMute, fontWeight: 700 }}>see more</span>
        </>
      )}
      {c.overLimit && (
        <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: "#B4442E" }}>
          {c.charCount}/{placement.captionLimit} characters — over the limit, this would be rejected.
        </div>
      )}
    </div>
  );
}

function ActionRow({ items, color }: { items: string[]; color: string }) {
  return (
    <div style={{ display: "flex", gap: 16, padding: "9px 12px", borderTop: `1px solid ${C.line}` }}>
      {items.map((t) => (
        <span key={t} style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 600, color }}>
          {t}
        </span>
      ))}
    </div>
  );
}

const card: React.CSSProperties = {
  border: `1px solid ${C.line}`,
  borderRadius: 10,
  overflow: "hidden",
  background: "#fff"
};

function LinkedInMock({
  placement,
  author,
  caption,
  Media,
  pageCount
}: {
  placement: Placement;
  author: Author;
  caption: string;
  Media: MediaFn;
  pageCount: number;
}) {
  const isDoc = placement.id === "linkedin-document";
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 12px 8px" }}>
        <Avatar author={author} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.ink }}>{author.displayName}</div>
          <div style={{ fontFamily: FONT, fontSize: 11, color: C.inkMute }}>Kognoz · 2h · 🌐</div>
        </div>
        <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: "#0A66C2" }}>+ Follow</span>
      </div>
      {/* LinkedIn puts the words above the picture. */}
      <div style={{ padding: "0 12px 10px" }}>
        <CaptionBlock caption={caption} placement={placement} />
      </div>
      <Media placement={placement} width={placement.cardW} />
      {isDoc && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "#F3F6F8",
            fontFamily: FONT,
            fontSize: 11.5,
            color: C.inkSoft
          }}
        >
          <span>Document · {pageCount} pages</span>
          <span style={{ fontWeight: 700, color: "#0A66C2" }}>Swipe ›</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", fontFamily: FONT, fontSize: 11, color: C.inkMute }}>
        <span>👍💡❤️</span>
        <span>48</span>
        <span style={{ marginLeft: "auto" }}>12 comments · 3 reposts</span>
      </div>
      <ActionRow items={["👍 Like", "💬 Comment", "🔁 Repost", "➤ Send"]} color={C.inkSoft} />
    </div>
  );
}

function InstagramMock({ placement, author, caption, Media }: { placement: Placement; author: Author; caption: string; Media: MediaFn }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px" }}>
        <Avatar author={author} size={30} ring />
        <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: C.ink }}>kognoz</div>
        <span style={{ marginLeft: "auto", color: C.inkMute, fontSize: 15, lineHeight: 1 }}>···</span>
      </div>
      <Media placement={placement} width={placement.cardW} />
      <div style={{ display: "flex", gap: 13, padding: "9px 11px 4px", fontSize: 15 }}>
        <span>♡</span>
        <span>💬</span>
        <span>➤</span>
        <span style={{ marginLeft: "auto" }}>🔖</span>
      </div>
      <div style={{ padding: "0 11px 11px" }}>
        <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 5 }}>1,204 likes</div>
        {/* Instagram puts the words below the picture. */}
        <CaptionBlock caption={caption} placement={placement} prefix="kognoz" />
        <div style={{ fontFamily: FONT, fontSize: 11.5, color: C.inkMute, marginTop: 5 }}>View all 18 comments</div>
      </div>
    </div>
  );
}

function XMock({ placement, author, caption, Media }: { placement: Placement; author: Author; caption: string; Media: MediaFn }) {
  return (
    <div style={{ ...card, borderColor: "#E4E7EA" }}>
      <div style={{ display: "flex", gap: 10, padding: "12px 12px 8px" }}>
        <Avatar author={author} size={38} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: C.inkMute }}>
            <strong style={{ color: C.ink, fontSize: 13 }}>{author.displayName}</strong> @kognoz · 2h
          </div>
          <div style={{ marginTop: 5 }}>
            <CaptionBlock caption={caption} placement={placement} />
          </div>
        </div>
      </div>
      {/* X rounds the media corners hard and insets it from the avatar gutter. */}
      <div style={{ padding: "0 12px 10px 60px" }}>
        <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${C.line}` }}>
          <Media placement={placement} width={placement.cardW - 72} />
        </div>
      </div>
      <ActionRow items={["💬 18", "🔁 24", "♡ 143", "📊 8.2K"]} color={C.inkMute} />
    </div>
  );
}

function StoryMock({ placement, author, Media }: { placement: Placement; author: Author; Media: MediaFn }) {
  return (
    <div style={{ borderRadius: 18, overflow: "hidden", background: "#000", position: "relative", border: `1px solid ${C.line}` }}>
      <Media placement={placement} width={placement.cardW} />
      <div style={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, background: i === 0 ? "#fff" : "rgba(255,255,255,0.4)" }} />
        ))}
      </div>
      <div style={{ position: "absolute", top: 18, left: 10, right: 10, display: "flex", alignItems: "center", gap: 7 }}>
        <Avatar author={author} size={24} />
        <span style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>kognoz</span>
        <span style={{ fontFamily: FONT, fontSize: 11, color: "rgba(255,255,255,0.8)" }}>2h</span>
        <span style={{ marginLeft: "auto", color: "#fff", fontSize: 15, lineHeight: 1 }}>✕</span>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          right: 12,
          height: 30,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.65)",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          fontFamily: FONT,
          fontSize: 11.5,
          color: "rgba(255,255,255,0.85)"
        }}
      >
        Send message
      </div>
    </div>
  );
}

function GridMock({ placement, Media }: { placement: Placement; Media: MediaFn }) {
  const cell = Math.round((placement.cardW - 4) / 3);
  return (
    <div style={{ display: "flex", gap: 2, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", padding: 2, background: "#fff" }}>
      <div style={{ width: cell, height: cell, background: C.mist }} />
      <div style={{ width: cell, overflow: "hidden" }}>
        <Media placement={placement} width={cell} />
      </div>
      <div style={{ width: cell, height: cell, background: C.mist }} />
    </div>
  );
}

function Verdict({ fit, warn, placement }: { fit: ReturnType<typeof placementFit>; warn: string | null; placement: Placement }) {
  const tone =
    fit.severity === "severe"
      ? { bg: "#F8EAE7", fg: "#A33B2C", chip: "Cropped hard" }
      : fit.mode === "full"
      ? { bg: "#E6F2EC", fg: "#2A7150", chip: "Fits" }
      : { bg: "#FBF1E2", fg: "#96631A", chip: fit.mode === "letterboxed" ? "Letterboxed" : "Cropped" };

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: 4,
            background: tone.bg,
            color: tone.fg
          }}
        >
          {tone.chip}
        </span>
        <span style={{ fontFamily: FONT, fontSize: 11, color: C.inkMute }}>
          shows {describeAspect(fit.renderedAspect)}
          {placement.minAspect !== placement.maxAspect
            ? ` · accepts ${describeAspect(placement.minAspect)}–${describeAspect(placement.maxAspect)}`
            : ""}
        </span>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 11.5, lineHeight: 1.5, color: warn ? tone.fg : C.inkMute }}>
        {warn || placement.blurb}
      </div>
    </div>
  );
}
