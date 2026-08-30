// Export pipeline — ported verbatim from kognoz-social-studio-v3.jsx
// (buildSlideSvg, loadSlideImage, slideCanvas, exportPdf, exportPanorama,
// exportStrip, exportPNG). PRD §12. Font embedding added per §3.3 (see
// exportFonts.ts) — the one deliberate addition beyond the reference.
//
// Slide → image core: serialize slide DOM → XHTML sanitize → wrap in SVG
// foreignObject → DOMParser XML validation surfacing parsererror text → load
// via Blob URL with base64 data-URL fallback → warm-up draw, fresh canvas,
// taint check → toBlob → download. Every failure surfaces its real name/message.
"use client";

import { buildPdfFromJpegs } from "./pdfBuilder";
import { getEmbeddableFontFaceCssSafe } from "./exportFonts";

export async function buildSlideSvg(elId: string, baseW: number, baseH: number, fontFaceCss: string): Promise<string | null> {
  const node = document.getElementById(elId);
  if (!node) return null;

  const clone = node.cloneNode(true) as HTMLElement;

  // Process all images to ensure they are inline base64 data URLs to prevent canvas cross-origin taint
  const liveImgs = Array.from(node.querySelectorAll("img"));
  const cloneImgs = Array.from(clone.querySelectorAll("img"));

  for (let i = 0; i < cloneImgs.length; i++) {
    const cloneImg = cloneImgs[i];
    const liveImg = liveImgs[i];
    const src = cloneImg.getAttribute("src") || "";

    if (src.startsWith("data:")) continue;

    // If loaded in live DOM, draw to temporary canvas to get data URL
    if (liveImg && liveImg.complete && liveImg.naturalWidth > 0) {
      try {
        const c = document.createElement("canvas");
        c.width = liveImg.naturalWidth;
        c.height = liveImg.naturalHeight;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(liveImg, 0, 0);
          const dataUrl = c.toDataURL("image/png");
          cloneImg.setAttribute("src", dataUrl);
          continue;
        }
      } catch (e) {
        console.warn("Could not canvas-convert live image:", e);
      }
    }

    // Fallback: fetch and convert to base64 data URL
    try {
      const res = await fetch(src);
      if (res.ok) {
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        cloneImg.setAttribute("src", dataUrl);
      }
    } catch (e) {
      console.warn("Could not fetch and inline image:", src, e);
    }
  }

  const html = clone.outerHTML
    .replace(/<input[^>]*>/g, "")
    .replace(/<img([^>]*?)\s*\/?>/g, "<img$1/>")
    .replace(/<br\s*>/g, "<br/>")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/&nbsp;/g, "&#160;");
  const style = fontFaceCss ? `<style>${fontFaceCss}</style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${baseW}" height="${baseH}">${style}<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${baseW}px;height:${baseH}px;">${html}</div></foreignObject></svg>`;
}

function loadImageFrom(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("image load blocked"));
    img.src = src;
  });
}

export async function loadSlideImage(
  elId: string,
  baseW: number,
  baseH: number
): Promise<{ img: HTMLImageElement; url: string | null } | null> {
  const fontFaceCss = await getEmbeddableFontFaceCssSafe();
  const svgStr = await buildSlideSvg(elId, baseW, baseH, fontFaceCss);
  if (!svgStr) return null;

  // Diagnose malformed XML on-device instead of failing blind.
  try {
    const doc = new DOMParser().parseFromString(svgStr, "image/svg+xml");
    const pe = doc.querySelector("parsererror");
    if (pe) throw new Error("XML: " + (pe.textContent || "").replace(/\s+/g, " ").slice(0, 140));
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("XML:")) throw e;
  }

  // Use base64 data URL to keep the SVG 100% self-contained and untainted
  const b64 = btoa(unescape(encodeURIComponent(svgStr)));
  const dataUrl = "data:image/svg+xml;base64," + b64;
  let img: HTMLImageElement;
  try {
    img = await loadImageFrom(dataUrl);
  } catch {
    // Fallback if base64 direct load fails
    const blobUrl = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }));
    img = await loadImageFrom(blobUrl);
  }

  if (img.decode) {
    try {
      await img.decode();
    } catch {
      /* some browsers refuse decode() on data/blob SVGs even when they render fine */
    }
  }
  await new Promise((r) => setTimeout(r, 150));
  return { img, url: null };
}

export async function slideCanvas(elId: string, baseW: number, baseH: number, scl: number): Promise<HTMLCanvasElement | null> {
  const loaded = await loadSlideImage(elId, baseW, baseH);
  if (!loaded) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(baseW * scl);
  canvas.height = Math.round(baseH * scl);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(loaded.img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function saveBlobAs(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }, 1500);
}

// Deck → PDF (primary export, PRD §12). elIds must be in deck order,
// e.g. ["exp-0", "exp-1", ...].
export async function exportPdf(
  elIds: string[],
  baseW: number,
  baseH: number,
  onProgress?: (slideN: number, total: number) => void,
  filenameBase = "kognoz-deck"
): Promise<void> {
  const jpegs: Uint8Array[] = [];
  const missed: number[] = [];
  for (let i = 0; i < elIds.length; i++) {
    onProgress?.(i + 1, elIds.length);
    const canvas = await slideCanvas(elIds[i], baseW, baseH, 1);
    if (!canvas) {
      // Skipping silently produced a short PDF that looked complete.
      missed.push(i + 1);
      continue;
    }
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const bin = atob(dataUrl.split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    jpegs.push(bytes);
  }
  if (!jpegs.length) throw new Error("no slides rendered");
  if (missed.length) throw new Error(`slides ${missed.join(", ")} could not be rendered`);
  saveBlobAs(buildPdfFromJpegs(jpegs, baseW, baseH), `${filenameBase}.pdf`);
}

export async function exportPanorama(elId: string, baseW: number, baseH: number, filenameBase = "kognoz-montage-panorama"): Promise<void> {
  const canvas = await slideCanvas(elId, baseW, baseH, 1);
  // Returning quietly meant the button did nothing at all — no file, no message.
  if (!canvas) throw new Error(`could not render ${elId}`);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((bl) => (bl ? res(bl) : rej(new Error("empty blob"))), "image/png"));
  saveBlobAs(blob, `${filenameBase}.png`);
}

// The whole deck as one tall image: review it, share it on WhatsApp, or
// archive the asset in a single file. Half-scale — keeps the tall canvas
// inside mobile canvas-memory limits (PRD §12).
export async function exportStrip(elIds: string[], baseW: number, baseH: number, filenameBase = "kognoz-deck-full"): Promise<void> {
  const SCL = 0.5;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(baseW * SCL);
  canvas.height = Math.round(baseH * SCL) * elIds.length;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const missed: number[] = [];
  for (let i = 0; i < elIds.length; i++) {
    const sc = await slideCanvas(elIds[i], baseW, baseH, SCL);
    if (!sc) {
      // A skipped slide left a white band, which reads as a design choice.
      missed.push(i + 1);
      continue;
    }
    ctx.drawImage(sc, 0, i * Math.round(baseH * SCL));
  }
  if (missed.length) throw new Error(`slides ${missed.join(", ")} could not be rendered`);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((bl) => (bl ? res(bl) : rej(new Error("empty blob"))), "image/png"));
  saveBlobAs(blob, `${filenameBase}.png`);
}

export interface ExportPngOpts {
  elId: string;
  baseW: number;
  baseH: number;
  frames?: number; // Montage only — slices into N frames
  filenameBase: string; // e.g. "kognoz-carousel-01"
  onFrameSaved?: (frameIndex: number) => void;
}

export async function exportPNG(opts: ExportPngOpts): Promise<void> {
  const { elId, baseW, baseH, frames, filenameBase, onFrameSaved } = opts;
  const rasterize = async (img: HTMLImageElement, w: number, h: number, offsetX: number): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, offsetX, 0);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((bl) => (bl ? res(bl) : rej(new Error("empty blob"))), "image/png"));
  };

  let loaded: { img: HTMLImageElement; url: string | null } | null = null;
  try {
    loaded = await loadSlideImage(elId, baseW, baseH);
    if (!loaded) return;
    if (frames) {
      const fw = baseW / frames;
      for (let k = 0; k < frames; k++) {
        const blob = await rasterize(loaded.img, fw, baseH, -k * fw);
        saveBlobAs(blob, `${filenameBase}-frame-${k + 1}.png`);
        onFrameSaved?.(k);
        await new Promise((r) => setTimeout(r, 600));
      }
    } else {
      const blob = await rasterize(loaded.img, baseW, baseH, 0);
      saveBlobAs(blob, `${filenameBase}.png`);
    }
  } catch (e) {
    throw e;
  }
}
