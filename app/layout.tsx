import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kognoz Social Studio",
  description: "AI-powered content production for the Kognoz LinkedIn presence."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* PRD §3.3 — Fraunces (display) + Open Sans (body) via Google Fonts for UI.
            Export pipeline embeds these as base64 @font-face separately (§12) —
            that's a different code path, not this <link>. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Open+Sans:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
