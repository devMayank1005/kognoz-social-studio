// Content pillars — one accent colour and eyebrow per pillar, per brand.
//
// Kognoz's five are ported verbatim from kognoz-social-studio-v3.jsx and are
// unchanged. Konverz's six come from social-studio-v4-kognoz-konverz.jsx
// (KONVERZ_PILLARS) and are keyed to the brand kit's module colours rather than
// to the Kognoz token set, which is why they are literals here and not `C.*`:
// they have to stay the same magenta/violet/teal whichever palette is loaded.
import { C } from "./tokens";

export const PILLARS: Record<string, string> = {
  "Behavioral Signal": C.cyan,
  "Human + AI": C.blue,
  "Consulting POV": C.teal,
  "From the Work": C.green,
  "Market Intelligence": C.gradTo
};

export const KONVERZ_PILLARS: Record<string, string> = {
  "Outcome Proof": "#B52879", // magenta — the proof numbers
  "How It Works": "#005382", // deep blue — mechanism
  "Customer Story": "#6B4FC9", // violet — named-speaker results
  "Talent Intelligence POV": "#55B09D", // teal — the category argument
  "Market Intelligence": "#2196F3", // Coach blue — verified external figures
  "Product Update": "#607D8B" // Learn slate — what shipped
};
