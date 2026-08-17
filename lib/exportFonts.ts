// Font embedding for exports — PRD §3.3: "fetch both fonts once, convert to
// base64, and embed as @font-face inside each export SVG's <style> so
// rasterized PNGs/PDF pages render true Fraunces (the artifact version fell
// back to Georgia — unacceptable for production)."
//
// This is new work beyond the reference jsx (which has this exact defect —
// PRD names it explicitly), built to the PRD's own spec rather than guessed.
// Runs entirely in the browser at export time; nothing here touches a server
// or a secret. Not exercised in this sandbox (no network path to
// fonts.googleapis.com here) — needs a real-browser smoke test once deployed,
// flagged in README.
"use client";

import { GOOGLE_FONTS_URL } from "./tokens";

let cachedFontFaceCss: string | null = null; // cache once per session, per PRD §17

async function toBase64DataUrl(res: Response): Promise<string> {
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  const contentType = res.headers.get("content-type") || "font/woff2";
  return `data:${contentType};base64,${b64}`;
}

// Fetches the Google Fonts CSS (which the browser's own Accept/User-Agent
// negotiates to woff2 for modern browsers), then re-fetches every referenced
// font file and inlines it as a base64 data URL in place of the remote url(),
// so the resulting CSS is fully self-contained — safe to drop into an SVG
// <style> that will be rasterized outside the DOM (no external fetch happens
// during rasterization, which is what breaks font loading in canvas export).
export async function getEmbeddableFontFaceCss(): Promise<string> {
  if (cachedFontFaceCss) return cachedFontFaceCss;

  const cssRes = await fetch(GOOGLE_FONTS_URL);
  if (!cssRes.ok) throw new Error(`font CSS fetch failed: HTTP ${cssRes.status}`);
  const css = await cssRes.text();

  const urlPattern = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
  const urls = Array.from(new Set(Array.from(css.matchAll(urlPattern), (m) => m[1])));

  const replacements = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`font file fetch failed (${url}): HTTP ${res.status}`);
      return [url, await toBase64DataUrl(res)] as const;
    })
  );

  let inlined = css;
  for (const [url, dataUrl] of replacements) {
    inlined = inlined.split(url).join(dataUrl);
  }

  cachedFontFaceCss = inlined;
  return inlined;
}

// Best-effort: export still proceeds without embedded fonts (falls back to
// the browser's system serif/sans, same degraded behavior the PRD names as
// the known defect) rather than blocking the whole export on a font fetch
// failure. Every failure is still visible — the caller decides how to surface it.
export async function getEmbeddableFontFaceCssSafe(): Promise<string> {
  try {
    return await getEmbeddableFontFaceCss();
  } catch (e) {
    console.error("Font embedding failed, exports will use fallback fonts:", e);
    return "";
  }
}
