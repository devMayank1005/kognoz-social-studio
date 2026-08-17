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

export function buildSlideSvg(elId: string, baseW: number, baseH: number, fontFaceCss: string): string | null {
  const node = document.getElementById(elId);
  if (!node) return null;
  const html = node.outerHTML
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
  const svgStr = buildSlideSvg(elId, baseW, baseH, fontFaceCss);
  if (!svgStr) return null;

  // Diagnose malformed XML on-device instead of failing blind.
  try {
    const doc = new DOMParser().parseFromString(svgStr, "image/svg+xml");
    const pe = doc.querySelector("parsererror");
    if (pe) throw new Error("XML: " + (pe.textContent || "").replace(/\s+/g, " ").slice(0, 140));
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("XML:")) throw e;
  }

  // Path 1: blob URL (fastest). Path 2: base64 data URL (works where CSP
  // blocks blob: images, which some embedded webviews do).
  let img: HTMLImageElement | null = null;
  let url: string | null = null;
  try {
    url = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }));
    img = await loadImageFrom(url);
  } catch {
    if (url) {
      URL.revokeObjectURL(url);
      url = null;
    }
    const b64 = btoa(unescape(encodeURIComponent(svgStr)));
    img = await loadImageFrom("data:image/svg+xml;base64," + b64).catch(() => {
      throw new Error("SVG load blocked on both blob and data URLs");
    });
  }
  if (img.decode) {
    try {
      await img.decode();
    } catch {
      /* some browsers refuse decode() on data/blob SVGs even when they render fine */
    }
  }
  await new Promise((r) => setTimeout(r, 150));
  return { img, url };
}

export async function slideCanvas(elId: string, baseW: number, baseH: number, scl: number): Promise<HTMLCanvasElement | null> {
  const loaded = await loadSlideImage(elId, baseW, baseH);
  if (!loaded) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(baseW * scl);
  canvas.height = Math.round(baseH * scl);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(loaded.img, 0, 0, canvas.width, canvas.height);
  await new Promise((r) => setTimeout(r, 100));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(loaded.img, 0, 0, canvas.width, canvas.height);
  ctx.getImageData(0, 0, 1, 1); // taint check — throws SecurityError if the canvas got tainted
  if (loaded.url) URL.revokeObjectURL(loaded.url);
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
  onProgress?: (slideN: number, total: number) => void
): Promise<void> {
  const jpegs: Uint8Array[] = [];
  for (let i = 0; i < elIds.length; i++) {
    onProgress?.(i + 1, elIds.length);
    const canvas = await slideCanvas(elIds[i], baseW, baseH, 1);
    if (!canvas) continue;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const bin = atob(dataUrl.split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    jpegs.push(bytes);
  }
  if (!jpegs.length) throw new Error("no slides rendered");
  saveBlobAs(buildPdfFromJpegs(jpegs, baseW, baseH), "kognoz-deck.pdf");
}

export async function exportPanorama(elId: string, baseW: number, baseH: number): Promise<void> {
  const canvas = await slideCanvas(elId, baseW, baseH, 1);
  if (!canvas) return;
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((bl) => (bl ? res(bl) : rej(new Error("empty blob"))), "image/png"));
  saveBlobAs(blob, "kognoz-montage-panorama.png");
}

// The whole deck as one tall image: review it, share it on WhatsApp, or
// archive the asset in a single file. Half-scale — keeps the tall canvas
// inside mobile canvas-memory limits (PRD §12).
export async function exportStrip(elIds: string[], baseW: number, baseH: number): Promise<void> {
  const SCL = 0.5;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(baseW * SCL);
  canvas.height = Math.round(baseH * SCL) * elIds.length;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < elIds.length; i++) {
    const sc = await slideCanvas(elIds[i], baseW, baseH, SCL);
    if (!sc) continue;
    ctx.drawImage(sc, 0, i * Math.round(baseH * SCL));
  }
  ctx.getImageData(0, 0, 1, 1);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((bl) => (bl ? res(bl) : rej(new Error("empty blob"))), "image/png"));
  saveBlobAs(blob, "kognoz-deck-full.png");
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
    ctx.drawImage(img, offsetX, 0);
    await new Promise((r) => setTimeout(r, 120));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, offsetX, 0);
    ctx.getImageData(0, 0, 1, 1);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((bl) => (bl ? res(bl) : rej(new Error("empty blob"))), "image/png"));
  };

  let loaded: { img: HTMLImageElement; url: string | null } | null = null;
  try {
    loaded = await loadSlideImage(elId, baseW, baseH);
    if (!loaded) return;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (frames) {
          const fw = baseW / frames;
          for (let k = 0; k < frames; k++) {
            const blob = await rasterize(loaded.img, fw, baseH, -k * fw);
            saveBlobAs(blob, `${filenameBase}-frame-${k + 1}.png`);
            onFrameSaved?.(k);
            await new Promise((r) => setTimeout(r, 800));
          }
        } else {
          const blob = await rasterize(loaded.img, baseW, baseH, 0);
          saveBlobAs(blob, `${filenameBase}.png`);
        }
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    if (loaded.url) URL.revokeObjectURL(loaded.url);
    if (lastErr) throw lastErr;
  } catch (e) {
    if (loaded && loaded.url) URL.revokeObjectURL(loaded.url);
    throw e;
  }
}
