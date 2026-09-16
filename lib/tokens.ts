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

// ---------------------------------------------------------------------------
// Second brand: Konverz AI.
//
// Everything above is Kognoz and stays exactly as it was — those are the proven
// values and this file's own header says not to "improve" them. What follows is
// additive: a second token set with the same SHAPE, so a component can swap the
// whole object and every `C.blue` reference downstream keeps working.
//
// Source: the Konverz brand kit (Konverz_Website_Inputs.md §1.2). The mapping
// from Konverz's named colours onto Kognoz's slot names is deliberate, because
// the slot names are what the renderers read:
//
//   blue  -> deep blue #005382   the authority colour, the wordmark
//   cyan  -> magenta   #B52879   the primary accent and the speech-bubble mark
//   teal  -> teal      #55B09D   shared with Kognoz; the "AI acts" signal
//   green -> teal               Konverz has no green; the slot is reused rather
//                               than left to render a Kognoz colour by accident
// ---------------------------------------------------------------------------

/**
 * The shape every brand palette has to fill. `C` is declared `as const`, so
 * `typeof C` would pin each slot to its Kognoz literal ("#005184" and nothing
 * else) and no second palette could satisfy it. Widening to string keeps the
 * KEYS exact — a palette missing `inkMute`, or inventing `purple`, still fails
 * to compile — while letting the values differ, which is the whole point.
 */
export type PaletteTokens = Record<keyof typeof C, string>;

export const KONVERZ_C: PaletteTokens = {
  blue: "#005382",
  green: "#55B09D",
  cyan: "#B52879",
  teal: "#55B09D",
  ink: "#212121",
  inkSoft: "#4A4558",
  inkMute: "#6E6880",
  off: "#FAF8F9",
  mist: "#F3EDF6",
  line: "#E4DEE8",
  lineD: "#D2C9D8",
  white: "#ffffff",
  gradFrom: "#B52879",
  gradTo: "#005382"
};

/** magenta -> violet -> deep blue, the signature gradient from the brand kit. */
export const KONVERZ_GRAD = "linear-gradient(90deg, #B52879 0%, #6B4FC9 50%, #005382 100%)";
export const KONVERZ_GRAD_DARK = "linear-gradient(150deg, #0B2A44 0%, #005382 55%, #3E2F7A 100%)";

/**
 * The gradient word, on a dark ground.
 *
 * The brand gradient ends in the deep blue #005382 — which is the MIDDLE STOP OF
 * KONVERZ_GRAD_DARK above. So a marked phrase on a boardroom slide faded into the
 * background over its last few characters: "selection in one *flow*" rendered as
 * "selection in one" and then nothing. Caught by looking at a rendered slide; the
 * clip was applied correctly and every test passed.
 *
 * Same ramp, same reading order — magenta, violet, blue — lifted until each stop
 * carries on a dark page. Kognoz needs no equivalent: its cyan-to-green runs light
 * the whole way and reads on navy as it is, which is why KOGNOZ.GRAD_ON_DARK is
 * simply its own gradient.
 */
export const KONVERZ_GRAD_ON_DARK = "linear-gradient(90deg, #F06BAE 0%, #A88CF0 50%, #6CC5F0 100%)";

// Poppins for both body and display. Konverz_Website_Inputs.md §9 lists the font
// as OBSERVED across the deck and site but NOT yet confirmed as official. It is a
// single pair of constants for exactly that reason — confirming or replacing it is
// a two-line change here and nothing else moves.
export const KONVERZ_FONT = "'Poppins', 'Segoe UI', system-ui, sans-serif";
export const KONVERZ_DISPLAY_FONT = "'Poppins', 'Segoe UI', system-ui, sans-serif";

export const KONVERZ_GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap";

// Konverz module tints (brand kit §1.2). The panel background for a given accent:
// journey columns and card panels are tinted per module rather than sharing one
// neutral, which is most of what makes a Konverz slide read as Konverz.
export const KONVERZ_TINT: Record<string, string> = {
  "#B52879": "#FCE4EC", // magenta / Hire
  "#005382": "#E3F2FD", // deep blue
  "#6B4FC9": "#EFE9FA", // violet
  "#55B09D": "#E8F5E9", // teal / Nurture
  "#2196F3": "#E3F2FD", // Coach
  "#607D8B": "#ECEFF1" // Learn
};

export const KONVERZ_TINT_FALLBACK = "#F3EDF6";
