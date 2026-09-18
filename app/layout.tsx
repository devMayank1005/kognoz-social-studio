import type { Metadata } from "next";
import { Providers } from "./providers";
import { browserFontsUrl } from "@/lib/fontRegistry";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Studio",
  description: "AI-powered content production for the Kognoz and Konverz AI LinkedIn presence.",
  // Icons come from the App Router file conventions — app/favicon.ico (16/32/48),
  // app/icon.png (512), app/apple-icon.png (180). An explicit `icons` block here
  // would override those and drop the content hash Next appends for cache-busting.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* One stylesheet, built from lib/fontRegistry.ts.

            This was a hardcoded URL duplicating the two constants in lib/tokens.ts, and
            it had already drifted from them: it asked for Open Sans at 400/600/700
            while a slide renderer uses weight 800 (components/Slide.tsx:1486). That
            title was a SYNTHESISED bold on screen and a TRUE 800 in the exported file,
            and nothing reported the difference. The registry now requests slide faces
            at exactly the weights exports embed, so the preview is the proof.

            Both brands' faces load together rather than swapping on a brand change: a
            <link> swap re-flows the whole page mid-session, and the second family is a
            few tens of KB against a tool already loading brand PNGs inline.

            NOTE: Poppins remains an ASSUMPTION for Konverz — Konverz_Website_Inputs.md
            §9 lists it as observed across the deck and site, not confirmed as official.
            It is one entry in the registry; replacing it moves nothing else.

            Export embedding is a different code path (lib/exportFonts.ts base64s the
            faces into the SVG). It reads the registry's SLIDE url, which deliberately
            excludes the two UI families. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={browserFontsUrl()} rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
