"use client";

import React, { useEffect, useState } from "react";
import { useBrand } from "@/components/BrandProvider";
import { buildArticlePrompt } from "@/lib/promptBuilders";
import { callClaudeText, FAST_MODEL } from "@/lib/claudeClient";
import { humanizeNote, humanizeText } from "@/lib/humanizePass";
import { pickSamples, type VoiceSample } from "@/lib/voiceSamples";
import {
  ARTICLE_DRAFT_KEY,
  isWorthSaving,
  makeDraft,
  serialiseDraft,
  parseDraft,
  sameTopic
} from "@/lib/articleDraft";
import { saveBlobAs } from "@/lib/exportPipeline";

// The long-form article writer.
//
// Lifted out of Studio.tsx, where it was one branch of a 2,564-line component gated on
// `format === "Article Cover"` — which is why it could not be found without being told
// where to look. It now has its own destination at /articles AND still appears inside
// Studio's Article Cover panel, because the cover and the article genuinely belong
// together when you are making one.
//
// It owns its own state deliberately. Everything here — the draft that survives a
// refresh, the undo, the stale banner, the two-pass humanise — is behaviour that was
// built in response to a real complaint, and keeping it together means neither host has
// to remember to reimplement any of it.

export interface ArticleWriterProps {
  topic: string;
  pillar: string;
  /** Whose byline. Without it a long article is written by nobody in particular. */
  channel: string;
  voiceSamples: VoiceSample[];
  seed: number;
  /** An external generation in flight. Studio passes its own `loading`. */
  busy?: boolean;
  /**
   * Bump this to mark the current article stale.
   *
   * Studio increments it when the deck is regenerated: the article was written for the
   * previous version. A counter rather than a boolean so the host does not have to
   * remember to clear it — writing again clears it here.
   */
  staleSignal?: number;
  onUsedSamples?: (samples: VoiceSample[]) => void;
  onPassNote?: (note: string) => void;
  onError?: (message: string) => void;
}

export function ArticleWriter({
  topic,
  pillar,
  channel,
  voiceSamples,
  seed,
  busy = false,
  staleSignal = 0,
  onUsedSamples,
  onPassNote,
  onError
}: ArticleWriterProps) {
  const brand = useBrand();
  const C = brand.C;
  const GRAD = brand.GRAD;
  const font = brand.font;

  const [article, setArticle] = useState("");
  const [artBusy, setArtBusy] = useState(false);
  const [artInstr, setArtInstr] = useState("");
  const [copied, setCopied] = useState(false);

  // Every AI action REPLACES what you wrote, and replacing React state wipes the
  // browser's native Cmd+Z stack — so without a snapshot the only way back to your own
  // words is paying for another generation.
  const [articleUndo, setArticleUndo] = useState<{ text: string; label: string } | null>(null);

  const [stale, setStale] = useState(false);
  /** The topic a restored draft was written for, so a mismatch can be spotted later. */
  const [draftTopic, setDraftTopic] = useState<string | null>(null);

  // Derived at render, NOT decided in the restore effect. The restore runs on mount,
  // before whatever primes `topic` (Studio's calendar link, this page's input), so
  // comparing there compared against an empty string every time and never fired.
  const draftTopicMismatch = Boolean(article && draftTopic && topic.trim() && !sameTopic(draftTopic, topic));

  /**
   * The article is the one expensive thing here that a refresh used to destroy: it was
   * component state only, so a reload lost a 900–1200 word piece that cost about $0.02.
   * localStorage rather than /api/store on purpose — the store blobs are shared
   * team-wide, and a half-written draft belongs to the person writing it.
   */
  const saveArticleDraft = (text: string) => {
    if (typeof window === "undefined") return;
    try {
      if (!isWorthSaving(text)) {
        localStorage.removeItem(ARTICLE_DRAFT_KEY);
        return;
      }
      localStorage.setItem(ARTICLE_DRAFT_KEY, serialiseDraft(makeDraft(topic, pillar, text, new Date().toISOString())));
    } catch {
      /* private mode or quota — the draft is still on screen, which is the common case */
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(ARTICLE_DRAFT_KEY);
    } catch {
      return;
    }
    const draft = parseDraft(raw);
    if (!draft) return;
    setArticle(draft.text);
    // Only record WHICH topic it was written for; see draftTopicMismatch above.
    setDraftTopic(draft.topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once, on mount
  }, []);

  // The host says "what you have was written for the previous deck". Skipped on the
  // first render so an initial staleSignal of 0 does not flag a fresh, correct article.
  const [seenSignal, setSeenSignal] = useState(staleSignal);
  useEffect(() => {
    if (staleSignal === seenSignal) return;
    setSeenSignal(staleSignal);
    setStale((prev) => prev || Boolean(article));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- article read intentionally at signal time
  }, [staleSignal]);

  const canWrite = !artBusy && !busy && Boolean(topic.trim());

  async function writeArticle(instruction?: string) {
    if (!canWrite) return;
    setArtBusy(true);
    onError?.("");
    try {
      const samples = pickSamples(voiceSamples, { channel, kind: "article", seed });
      onUsedSamples?.(samples);
      const prompt = buildArticlePrompt({
        brand,
        topic,
        pillar,
        instruction,
        currentArticle: article,
        voiceSamples: samples,
        channel,
        seed
      });
      const text = await callClaudeText("article", prompt, {
        model: instruction && instruction.trim() ? FAST_MODEL : undefined,
        maxTokens: 2600
      });

      // Second pass. Skipped on a targeted revision: the team asked for one specific
      // change, and a line edit on top of it would quietly rewrite the rest of a piece
      // they had already approved.
      let finalText = text.trim();
      if (instruction && instruction.trim()) {
        onPassNote?.("");
      } else {
        const edited = await humanizeText(finalText, { brand, voiceSamples: samples, channel, maxTokens: 6000 });
        finalText = edited.value.trim();
        onPassNote?.(humanizeNote(edited));
      }

      setArticleUndo(article ? { text: article, label: instruction?.trim() ? "revision" : "rewrite" } : null);
      setArticle(finalText);
      saveArticleDraft(finalText);
      setDraftTopic(topic);
      setStale(false);
      setArtInstr("");
    } catch (e) {
      onError?.(
        `Article writing failed (${e instanceof Error ? e.message : e}). Try once more; tell me this message if it repeats.`
      );
    } finally {
      setArtBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: font,
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    fontSize: 13.5,
    color: C.ink,
    background: C.white,
    boxSizing: "border-box",
    outline: "none",
    resize: "vertical",
    lineHeight: 1.5
  };
  const ghostBtn: React.CSSProperties = {
    fontFamily: font,
    fontSize: 12,
    fontWeight: 700,
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
    border: `1.5px solid ${C.blue}`,
    color: C.blue,
    background: "transparent"
  };

  const words = article.split(/\s+/).filter(Boolean).length;

  return (
    <>
      {articleUndo && (
        <div style={{ fontFamily: font, fontSize: 11.5, color: C.inkMute, marginBottom: 8, lineHeight: 1.5 }}>
          Claude replaced your article.{" "}
          <button
            type="button"
            onClick={() => {
              setArticle(articleUndo.text);
              setArticleUndo(null);
            }}
            style={{
              fontFamily: font,
              fontSize: 11.5,
              fontWeight: 700,
              color: C.blue,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            Undo the {articleUndo.label}
          </button>
        </div>
      )}

      {(stale || draftTopicMismatch) && (
        <div style={{ fontFamily: font, fontSize: 11.5, color: C.inkMute, marginBottom: 8, lineHeight: 1.5 }}>
          Written for the previous version of this deck. Still yours to edit — rewrite only if it no longer fits.
        </div>
      )}

      <button
        onClick={() => writeArticle()}
        disabled={!canWrite}
        // It used to sit greyed out with no explanation, which reads as broken rather
        // than as waiting for input.
        title={!topic.trim() ? "Type a topic first" : undefined}
        style={{
          fontFamily: font,
          fontSize: 13.5,
          fontWeight: 700,
          padding: "11px 18px",
          borderRadius: 8,
          cursor: canWrite ? "pointer" : "default",
          border: "none",
          color: "#fff",
          background: GRAD,
          opacity: canWrite ? 1 : 0.6,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          marginBottom: 10
        }}
      >
        {artBusy ? "Writing the article…" : article ? "Rewrite from scratch" : "Write the full article"}
      </button>

      {article && (
        <>
          <textarea
            value={article}
            onChange={(e) => setArticle(e.target.value)}
            // Saved on blur rather than on every keystroke — the same pattern House
            // style already uses for its textarea.
            onBlur={(e) => saveArticleDraft(e.target.value)}
            rows={16}
            aria-label="Article text"
            style={{ ...inputStyle, fontSize: 12.5, lineHeight: 1.6, marginBottom: 8 }}
          />
          <div style={{ fontFamily: font, fontSize: 11, color: C.inkMute, marginBottom: 8 }}>
            {words} words · markdown headings paste cleanly into LinkedIn&apos;s article editor
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              value={artInstr}
              onChange={(e) => setArtInstr(e.target.value)}
              placeholder="Revise: e.g. sharpen the hook, shorten section 3, add a Gulf example"
              aria-label="Revision instruction"
              style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
            />
            <button
              onClick={() => writeArticle(artInstr)}
              disabled={artBusy || busy || !artInstr.trim()}
              // A bare glyph needs both a tooltip and an accessible name.
              title="Revise the article with this instruction"
              aria-label="Revise the article with this instruction"
              style={{
                fontFamily: font,
                fontSize: 12,
                fontWeight: 700,
                padding: "0 14px",
                borderRadius: 8,
                cursor: artBusy || busy || !artInstr.trim() ? "default" : "pointer",
                border: "none",
                color: "#fff",
                background: GRAD,
                opacity: artBusy || busy || !artInstr.trim() ? 0.55 : 1
              }}
            >
              ↻
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={async () => {
                // writeText returns a promise, so a denied permission or an insecure
                // origin escaped the old synchronous catch as an unhandled rejection
                // and the button gave no feedback either way.
                try {
                  await navigator.clipboard.writeText(article);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                } catch {
                  onError?.("Couldn't copy — your browser blocked clipboard access. Select the text and copy it manually.");
                }
              }}
              style={ghostBtn}
            >
              {copied ? "Copied ✓" : "Copy article"}
            </button>
            <button
              onClick={() => saveBlobAs(new Blob([article], { type: "text/markdown" }), `${brand.id}-article.md`)}
              style={ghostBtn}
            >
              ⬇ .md file
            </button>
          </div>
        </>
      )}
    </>
  );
}
