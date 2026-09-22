"use client";

// Recording the Kinetic Video format as a .webm.
//
// THE PROBLEM. Every other export rasterises the slide once: DOM → SVG → <img> → canvas.
// That cannot produce motion, and not by accident — lib/exportPipeline.ts strips <style>
// from the cloned node, so the @keyframes in app/globals.css are simply absent inside the
// SVG and every element renders at its settled state. That is what makes the existing
// "poster PNG" work, and it is why asking the pipeline for frame at t=1.3s returns the same
// picture every time.
//
// HOW THIS WORKS INSTEAD. The motion is only ever opacity and a vertical offset, so it does
// not need to be rasterised per frame — it needs to be COMPOSITED per frame. Each animated
// element is rasterised ONCE, on its own, at full opacity; the rest of the slide is
// rasterised once as a background. A frame is then a handful of drawImage calls with a
// globalAlpha and a translate, which is fast enough to record in real time.
//
// The alternative — re-serialising and re-rasterising the whole slide a few hundred times,
// each one re-parsing half a megabyte of base64 font — would take minutes and still have to
// resolve the timeline by hand. This way the expensive step happens about eighteen times.
//
// lib/kinetic.ts owns the timing, and the renderer formats its CSS from the same numbers,
// so the file cannot drift from the preview.

import { exportClone, saveBlobAs, wrapAsSvg } from "./exportPipeline";
import { getEmbeddableFontFaceCssSafe } from "./exportFonts";
import { kineticTimeline, styleAt, type KineticStep } from "./kinetic";

/** Frames per second of the recording. 30 is smooth and keeps the file small. */
export const FPS = 30;

/** How long the finished frame is held before the recording stops. */
export const TAIL_SECONDS = 1.2;

/**
 * The best WebM the browser can actually encode, or null if it cannot encode one.
 *
 * Safari is a supported target (PRD §"Browser support") and its MediaRecorder does not do
 * WebM at all — it emits MP4/H.264. Returning null lets the caller say so in words instead
 * of handing somebody a file their browser silently made empty.
 */
export function webmMimeType(recorder: { isTypeSupported(t: string): boolean } | undefined = typeof MediaRecorder !== "undefined" ? MediaRecorder : undefined): string | null {
  if (!recorder?.isTypeSupported) return null;
  for (const type of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
    if (recorder.isTypeSupported(type)) return type;
  }
  return null;
}

/** Total frames for a sequence, including the hold at the end. */
export function frameCount(duration: number, fps = FPS, tail = TAIL_SECONDS): number {
  return Math.max(1, Math.ceil((duration + tail) * fps));
}

interface Piece {
  step: KineticStep;
  /** Where this element sits, in slide pixels, measured off the live node. */
  rect: { x: number; y: number; w: number; h: number };
}

interface Layer {
  img: HTMLImageElement;
  pieces: Piece[];
}

export interface RecordOpts {
  /** The hidden full-size export node, e.g. `exp-0`. */
  elId: string;
  baseW: number;
  baseH: number;
  filename: string;
  fontsUrl?: string;
  /** 0–1, for a progress bar. Rasterising the layers is the slow half. */
  onProgress?: (fraction: number) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("frame failed to rasterise"));
    img.src = src;
  });
}

/** Rasterise the prepared clone as it currently stands. */
async function shoot(clone: HTMLElement, baseW: number, baseH: number, fontCss: string): Promise<HTMLImageElement> {
  const svg = wrapAsSvg(clone.outerHTML, baseW, baseH, fontCss);
  const img = await loadImage("data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg))));
  try {
    await img.decode();
  } catch {
    // Some browsers refuse decode() on a data-URL SVG that renders perfectly well.
  }
  return img;
}

/**
 * Record the kinetic sequence and download it.
 *
 * Throws with a readable message when the browser cannot encode WebM, when the slide node
 * is missing, or when the canvas turns out to be tainted — all three are things somebody
 * needs told rather than a zero-byte download.
 */
export async function recordKineticWebm(opts: RecordOpts): Promise<void> {
  const { elId, baseW, baseH, filename, fontsUrl, onProgress } = opts;

  const mimeType = webmMimeType();
  if (!mimeType) {
    throw new Error(
      "This browser cannot record WebM. Chrome, Edge or Firefox can; Safari records MP4 only. The poster PNG works everywhere."
    );
  }

  const fontCss = await getEmbeddableFontFaceCssSafe(fontsUrl);
  const clone = await exportClone(elId);
  if (!clone) throw new Error(`Slide ${elId} is not on the page`);

  const animated = Array.from(clone.querySelectorAll<HTMLElement>("[data-kv]"));
  if (!animated.length) throw new Error("This slide has no kinetic sequence to record");

  const words = animated.filter((n) => n.dataset.kv === "word");
  const beats = animated.filter((n) => n.dataset.kv === "beat");
  const timeline = kineticTimeline(words.length, beats.length);

  // Pair every node with its step, in the order lib/kinetic.ts lays them out.
  const steps = new Map<HTMLElement, KineticStep>();
  const eyebrow = animated.find((n) => n.dataset.kv === "eyebrow");
  const foot = animated.find((n) => n.dataset.kv === "foot");
  if (eyebrow) steps.set(eyebrow, timeline.eyebrow);
  if (foot) steps.set(foot, timeline.foot);
  words.forEach((n, i) => timeline.words[i] && steps.set(n, timeline.words[i]));
  beats.forEach((n, i) => timeline.beats[i] && steps.set(n, timeline.beats[i]));

  // The CSS animation has to go: with the keyframes stripped it does nothing anyway, but
  // leaving it would be one more thing claiming to own these properties.
  for (const node of animated) node.style.animation = "none";

  const show = (visible: HTMLElement | null) => {
    for (const node of animated) node.style.visibility = node === visible ? "visible" : "hidden";
  };

  // Where each element sits. Measured off the LIVE node rather than the clone, which is
  // detached and has no layout — and the live export copy renders at exactly baseW x baseH,
  // so its rects are already in slide pixels.
  const live = document.getElementById(elId);
  if (!live) throw new Error(`Slide ${elId} is not on the page`);
  const liveRoot = live.getBoundingClientRect();
  const liveNodes = Array.from(live.querySelectorAll<HTMLElement>("[data-kv]"));
  const rectOf = (index: number) => {
    const r = liveNodes[index]?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0, w: baseW, h: baseH };
    // Padded by the rise distance so a word is not clipped while it is still travelling.
    return {
      x: Math.max(0, r.left - liveRoot.left - 2),
      y: Math.max(0, r.top - liveRoot.top - 2),
      w: Math.min(baseW, r.width + 4),
      h: Math.min(baseH, r.height + 4)
    };
  };

  // Rasterising is the expensive step — each one re-parses half a megabyte of base64 font —
  // so elements are grouped by kind rather than shot one at a time. All twelve headline
  // words come off ONE rasterisation and are then composited individually from their own
  // rects, which takes the count from ~18 down to five however long the copy is.
  const groups = ["eyebrow", "word", "beat", "foot"] as const;
  const total = groups.length + 1;
  let done = 0;
  const tick = () => onProgress?.((done += 1) / total * 0.85);

  // The background: the page, the motif and the layout boxes, with every animated element
  // out of the way. Its size is unchanged, so each layer composites at the same origin.
  show(null);
  const background = await shoot(clone, baseW, baseH, fontCss);
  tick();

  const layers: Layer[] = [];
  for (const kind of groups) {
    const members = animated.filter((n) => n.dataset.kv === kind);
    if (!members.length) continue;
    for (const node of animated) node.style.visibility = node.dataset.kv === kind ? "visible" : "hidden";
    const img = await shoot(clone, baseW, baseH, fontCss);
    layers.push({
      img,
      pieces: members
        .map((node) => ({ step: steps.get(node)!, rect: rectOf(animated.indexOf(node)) }))
        .filter((piece) => piece.step)
    });
    tick();
  }

  const canvas = document.createElement("canvas");
  canvas.width = baseW;
  canvas.height = baseH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not open a canvas to record into");

  const paint = (t: number) => {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, baseW, baseH);
    ctx.drawImage(background, 0, 0);
    for (const { img, pieces } of layers) {
      for (const { step, rect } of pieces) {
        const { opacity, transform } = styleAt(step, t);
        if (opacity <= 0) continue;
        const dy = transform === "none" ? 0 : Number.parseFloat(transform.slice(transform.indexOf("(") + 1)) || 0;
        ctx.globalAlpha = opacity;
        // Source rect from the settled render, drawn at its offset position.
        ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, rect.x, rect.y + dy, rect.w, rect.h);
      }
    }
    ctx.globalAlpha = 1;
  };

  // A first frame before the recorder starts, so the clip does not open on blank white.
  paint(0);

  let stream: MediaStream;
  try {
    stream = canvas.captureStream(FPS);
  } catch {
    throw new Error("The canvas could not be recorded — an image on this slide is not inlined");
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const finished = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("Recording failed part way through"));
  });

  recorder.start();
  const runFor = timeline.duration + TAIL_SECONDS;
  const started = performance.now();

  // Paced by the clock, and driven by a TIMER rather than requestAnimationFrame.
  //
  // rAF does not fire at all in a backgrounded tab, so switching away mid-export left the
  // loop suspended and the recording never finished — it simply hung at the last progress
  // it had reached. A timer is throttled in the background rather than stopped, and because
  // captureStream samples the canvas itself, a slow loop costs duplicated frames instead of
  // a truncated clip. It degrades; it does not stall.
  //
  // Measured: with the tab hidden the timer is throttled to roughly once a second, so the
  // clip is still the right length but only a handful of distinct frames. Recording with
  // the tab in front is what gets the full 30.
  await new Promise<void>((resolve) => {
    const step = () => {
      const t = (performance.now() - started) / 1000;
      paint(Math.min(t, timeline.duration));
      onProgress?.(0.85 + Math.min(1, t / runFor) * 0.15);
      if (t >= runFor) resolve();
      else setTimeout(step, 1000 / FPS);
    };
    step();
  });

  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  await finished;

  if (!chunks.length) throw new Error("The recording came back empty");
  saveBlobAs(new Blob(chunks, { type: "video/webm" }), filename);
  onProgress?.(1);
}
