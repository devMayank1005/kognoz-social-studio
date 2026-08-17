// Kognoz Social Studio — design tokens.
// Ported verbatim from kognoz-social-studio-v3.jsx (the `C` const, GRAD, GRAD_DARK,
// fonts, glass tokens). Do not "improve" these — they're the proven values.

export const C = {
  blue: "#005184",
  green: "#88B787",
  cyan: "#43AFCD",
  teal: "#55B09D",
  ink: "#212121",
  inkSoft: "#4A5560",
  inkMute: "#6B7680",
  off: "#F4F7F9",
  mist: "#EAF1F4",
  line: "#DCE6EB",
  lineD: "#C9D7DF",
  white: "#ffffff",
  gradFrom: "#009BDD",
  gradTo: "#75A02F"
} as const;

export const GRAD = `linear-gradient(120deg, ${C.gradFrom}, ${C.gradTo})`;
export const GRAD_DARK = `linear-gradient(150deg, #063D5E 0%, ${C.blue} 60%, #0A6E8F 100%)`;

export const FONT = "'Open Sans', system-ui, sans-serif";
export const DISPLAY_FONT = "'Fraunces', Georgia, 'Times New Roman', serif";

export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Open+Sans:wght@400;600;700;800&display=swap";

// Glass tokens (§5 / jsx) — translucent fill + border + blur + deep shadow.
// Blur renders live in preview; exports keep translucency/border/shadow even if
// blur itself flattens on some browsers' rasterizers — designed to hold up either way.
export const GLASS_DARKBG = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.35)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow: "0 30px 80px rgba(0,20,45,0.35)"
} as const;

export const GLASS_LIGHTBG = {
  background: "rgba(255,255,255,0.55)",
  border: "1px solid rgba(255,255,255,0.8)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  boxShadow: "0 24px 60px rgba(0,40,70,0.16)"
} as const;

// Uniform card chrome (PRD §4 / jsx Slide component — footer + eyebrow, no accent bars).
export const FOOT = { left: 96, right: 96, bottom: 84, logoHeight: 64 } as const;
export const CONTENT_PADDING = "96px 96px 196px";
