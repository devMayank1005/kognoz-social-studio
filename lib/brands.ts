// The brand registry.
//
// Two brands share this studio: Kognoz (the consulting firm) and Konverz AI (its
// talent platform). Everything that differs between them is a field on a Brand,
// and everything that does not is left alone.
//
// WHY THIS IS DATA THREADED THROUGH CONTEXT, AND NOT MODULE GLOBALS.
//
// The v4 reference artifact (social-studio-v4-kognoz-konverz.jsx) switches brands
// by mutating module-level bindings:
//
//     let C = {...}; let GRAD = ...; let font = ...;
//     function applyBrand(id) { Object.assign(C, b.palette); GRAD = b.grad; ... }
//
// In a single-file browser artifact that is fine. In this app it is not. Module
// state on the server is shared across every request, so one user picking Konverz
// would repaint another user's render mid-flight; and on the client the imported
// bindings are read during hydration, so a mutation between server render and
// hydration is a mismatch. So the brand is a value, passed down.
//
// Components read it once at the top and shadow the module imports:
//
//     const brand = useBrand();
//     const { C, GRAD, GRAD_DARK, font, displayFont } = brand;
//
// which is what lets the ~190KB of existing renderer code keep saying `C.blue`
// without a single edit. Pure modules take an explicit `brand` argument instead;
// there is no context outside React.
import {
  C as KOGNOZ_C,
  GRAD as KOGNOZ_GRAD,
  GRAD_DARK as KOGNOZ_GRAD_DARK,
  FONT as KOGNOZ_FONT,
  DISPLAY_FONT as KOGNOZ_DISPLAY_FONT,
  GOOGLE_FONTS_URL as KOGNOZ_GOOGLE_FONTS_URL,
  KONVERZ_C,
  KONVERZ_GRAD,
  KONVERZ_GRAD_DARK,
  KONVERZ_FONT,
  KONVERZ_DISPLAY_FONT,
  KONVERZ_GOOGLE_FONTS_URL,
  KONVERZ_TINT,
  KONVERZ_TINT_FALLBACK,
  type PaletteTokens
} from "./tokens";
import {
  LOGO_COLOR_DATA,
  LOGO_WHITE_DATA,
  LOGO_MARK_DATA,
  KONVERZ_LOGO_COLOR_DATA,
  KONVERZ_LOGO_WHITE_DATA
} from "./brandLogos";
import { BRAND_CORE, PRACTICE_LANES, laneFor, laneText, type PracticeLane } from "./brandCore";
import { KONVERZ_CORE, KONVERZ_LANES, konverzDetect } from "./konverzCore";
import { PILLARS, KONVERZ_PILLARS } from "./pillars";
import { PLAN_TEMPLATE, TMPL_V, CHANNELS, type PlanItem } from "./calendarTemplate";
import { KONVERZ_PLAN_TEMPLATE, KONVERZ_TMPL_V } from "./konverzTemplate";
import {
  DESIGN_SETS,
  KONVERZ_DESIGN_SETS,
  LOOK_SETS,
  KONVERZ_LOOK_SETS,
  type DesignSetId,
  type DesignSetTable
} from "./designSets";
import {
  CHANNEL_IDS,
  KONVERZ_CHANNEL_IDS,
  FOUNDER_PROFILES,
  KONVERZ_PROFILES,
  DO_NOT_ASSERT,
  DO_NOT_ASSERT_KONVERZ,
  CADENCE,
  KONVERZ_CADENCE,
  type ChannelId,
  type FounderProfile
} from "./founderProfiles";
import type { FormatId } from "./formats";

export type BrandId = "kognoz" | "konverz";

/** Which background motif the slide renderer draws behind a headline. */
export type BrandMotif = "petal" | "halo" | "bubble";

/**
 * How the *asterisk* in a headline renders.
 *
 * "word" marks exactly that word in the gradient, which is the Kognoz homepage
 * signature. "tail" runs the gradient from the marked word to the end of the
 * line, which is how konverz.ai sets its hero. The prompts differ to match:
 * Kognoz is told to mark the word carrying the argument, Konverz to mark where
 * the promise begins.
 */
export type BrandEmMode = "word" | "tail";

export interface BrandLogos {
  color: string;
  white: string;
  mark: string;
  /** width / height of the wordmark, so the renderer can size it from a height. */
  aspect: number;
}

export interface BrandSplit {
  /** What the left column of a Says vs Does card argues, in prompt language. */
  left: string;
  right: string;
  leftLabel: string;
  rightLabel: string;
}

export interface Brand {
  id: BrandId;
  /** Full name as it appears in copy, e.g. "Konverz AI". */
  name: string;
  /** Short name for the brand switcher. */
  label: string;
  url: string;

  // ---- visual ----
  C: PaletteTokens;
  GRAD: string;
  GRAD_DARK: string;
  font: string;
  displayFont: string;
  googleFontsUrl: string;
  logos: BrandLogos;
  motif: BrandMotif;
  emMode: BrandEmMode;
  /** Draws the magenta four-point star before a section eyebrow. Konverz only. */
  sparkle: boolean;
  /** Prints "Empowered by Kognoz" in the slide footer. Konverz only. */
  empowered: boolean;
  /** Panel background for a given accent. Konverz tints per module; Kognoz uses one mist. */
  tintFor: (accent: string) => string;
  designSets: DesignSetTable;
  lookSets: DesignSetId[];
  defaultSet: DesignSetId;

  // ---- editorial ----
  pillars: Record<string, string>;
  channels: Record<string, string>;
  channelIds: ChannelId[];
  profiles: Partial<Record<ChannelId, FounderProfile>>;
  /** The channel an unassigned post falls back to. Never a real person. */
  defaultChannel: ChannelId;
  cadence: { postsPerMonth: number; weekdaysOnly: boolean; perChannel: Partial<Record<ChannelId, number>> };
  template: PlanItem[];
  templateVersion: number;

  // ---- prompt ----
  /** The ground-truth canon injected into every fresh generation. */
  core: string;
  /** Lane text by lane id, and the detector that picks one from a topic. */
  lanes: Record<string, string>;
  detect: (topic: unknown) => string | null;
  /**
   * Renders one lane with a seed so its illustration rotates between runs.
   * Kognoz has one; every generation used to see the same example sentence and
   * the model reliably reused it, which is a large part of why every deck once
   * sounded like every other deck. Konverz's lanes carry no illustrations, so it
   * has none and `lanes` is read directly.
   */
  laneText?: (lane: string, seed: number) => string;
  /** The sentence naming the lanes, used when the detector finds none. */
  laneFallback: string;
  doNotAssert: string[];
  /**
   * What the market scan should go and read about.
   *
   * Deliberately the MARKET and not the product: the geographies, the buyer
   * roles, and the operational subjects whose facts change. A scope written in
   * product terms turns the research into a search for validation, and the list
   * comes back as a brochure.
   */
  marketScope: string;
  /**
   * The brand's own figures, named so the fact-checker does not spend a search
   * budget re-verifying numbers the client already stands behind. Phrased as a
   * full sentence because it is dropped into the verify prompt as one.
   */
  canonNumbers: string;
  voiceHeader: string;
  writingBrief: string;
  vocabulary: string;
  /**
   * Banned phrases this brand is exempt from. A SUBTRACTION from the shared list
   * in lib/slopLint.ts, never an addition. See `bannedFor` there for why.
   */
  allowedPhrases: string[];
  split: BrandSplit;
  /** Kicker on the Idea Deck closing card. */
  readCloser: string;
  /**
   * How the brand's own turn is labelled in a Dialogue card, and how the renderer
   * knows which side of the exchange to align right. A reply titled "Kognoz"
   * under a Konverz logo reads as the wrong company answering.
   */
  speaker: string;
  editVoice: string;
  articleVoice: string;
  exampleSource: string;
  checkerFor: string;
  /** Per-format steer, where a brand needs one. Konverz does; Kognoz does not. */
  formatGuide: Partial<Record<FormatId, string>> | null;
  endCta: string;
}

export const KOGNOZ: Brand = {
  id: "kognoz",
  name: "Kognoz",
  label: "Kognoz",
  url: "kognozconsulting.com",

  C: KOGNOZ_C,
  GRAD: KOGNOZ_GRAD,
  GRAD_DARK: KOGNOZ_GRAD_DARK,
  font: KOGNOZ_FONT,
  displayFont: KOGNOZ_DISPLAY_FONT,
  googleFontsUrl: KOGNOZ_GOOGLE_FONTS_URL,
  logos: { color: LOGO_COLOR_DATA, white: LOGO_WHITE_DATA, mark: LOGO_MARK_DATA, aspect: 3.6 },
  motif: "petal",
  emMode: "word",
  sparkle: false,
  empowered: false,
  tintFor: () => KOGNOZ_C.mist,
  designSets: DESIGN_SETS,
  lookSets: LOOK_SETS,
  defaultSet: "editorial",

  pillars: PILLARS,
  channels: CHANNELS,
  channelIds: CHANNEL_IDS,
  profiles: FOUNDER_PROFILES,
  defaultChannel: "Kognoz page",
  cadence: CADENCE,
  template: PLAN_TEMPLATE,
  templateVersion: TMPL_V,

  core: BRAND_CORE,
  lanes: PRACTICE_LANES,
  detect: laneFor,
  laneText: (lane, seed) => laneText(lane as PracticeLane, seed),
  laneFallback:
    "SUBJECT DISCIPLINE: choose ONE Kognoz practice lens for this piece (Culture, Talent & Leadership, Organization Design, Human + AI Work Design, or Family Business) and stay strictly inside it. Do not blend frameworks from different practices.",
  doNotAssert: DO_NOT_ASSERT,
  canonNumbers:
    "Kognoz's own proof numbers (650,000+ jobs architected, 50,000+ leadership assessments, 200+ enterprises, 12 countries).",
  marketScope:
    "CEOs, CHROs, promoters and business owners at large enterprises, conglomerates and family-led groups across India and Southeast Asia. The subjects that move: culture and engagement measurement, psychological safety and speak-up, org design, decision rights, spans and layers, succession depth and leadership readiness, regretted attrition, internal mobility, job architecture, AI adoption inside the HR function and the work redesign around it, and generational transition in family businesses.",
  voiceHeader:
    "You write for Kognoz, a people-consulting firm for CEOs, CHROs, promoters, and business owners across India and Southeast Asia. Kognoz reads what people and organizations actually do, through behavioral science and AI, and turns it into decisions leaders can trust. The audience is senior executives deciding who to bring in on their hardest people problems.",
  // NOTE: this is the repo's corrected wording, not the v4 file's. v4 still says
  // "India, the Middle East, and Southeast Asia" in its voice header and still
  // offers "the Immersion Index" as approved vocabulary. DO_NOT_ASSERT forbids
  // both, and lib/brandCore.ts removed them with a written reason. The correction
  // wins; do not re-import v4's Kognoz strings over it.
  writingBrief: `WRITE LIKE A SENIOR PARTNER SPEAKING TO A CEO. Not a content marketer, not an analyst, not an AI.
- Speak to consequences leaders own: growth that stalls, succession that is not real, a culture quietly working against the strategy, AI spend that changes nothing.
- Behavioral language always: name what people do, never how they feel.
- Evidence in every piece: a defensible number, an observed behavior, or an anonymized moment from real client work. Kognoz has architected 650,000+ jobs and run 50,000+ leadership assessments across 200+ enterprises; use scale like this only where it is natural.
- Declarative sentences. Specific nouns. Confidence without adjectives.
- In the headline, mark exactly ONE pivotal word or two-word phrase with *asterisks*; it renders in the Kognoz gradient. Choose the word that carries the argument.`,
  vocabulary: `KOGNOZ VOCABULARY, used only where genuinely apt: behavioral signals, the Human-AI Work Spectrum, job architecture, decision rights, succession depth, talent intelligence, "AI recommends, people decide."`,
  allowedPhrases: [],
  split: {
    left: "what people or surveys SAY",
    right: "what behavior actually SHOWS",
    leftLabel: "What the survey says",
    rightLabel: "What behavior says"
  },
  readCloser: "The Kognoz read",
  speaker: "Kognoz",
  editVoice: "a senior partner speaking to a CEO",
  articleVoice: "a senior partner writing personally",
  exampleSource: "real consulting work",
  checkerFor: "Kognoz, a consulting firm",
  formatGuide: null,
  endCta: "See how we read what people actually do"
};

export const KONVERZ: Brand = {
  id: "konverz",
  name: "Konverz AI",
  label: "Konverz AI",
  url: "konverz.ai",

  C: KONVERZ_C,
  GRAD: KONVERZ_GRAD,
  GRAD_DARK: KONVERZ_GRAD_DARK,
  font: KONVERZ_FONT,
  displayFont: KONVERZ_DISPLAY_FONT,
  googleFontsUrl: KONVERZ_GOOGLE_FONTS_URL,
  // `mark` points at the colour wordmark deliberately. The brand kit describes a
  // real mark (the magenta speech-bubble "o", used solo as a watermark) but only
  // the wordmark is embedded in the v4 file. Repoint this when the official file
  // arrives; nothing else needs to change.
  logos: {
    color: KONVERZ_LOGO_COLOR_DATA,
    white: KONVERZ_LOGO_WHITE_DATA,
    mark: KONVERZ_LOGO_COLOR_DATA,
    aspect: 6.24
  },
  motif: "halo",
  emMode: "tail",
  sparkle: true,
  empowered: true,
  tintFor: (accent: string) => KONVERZ_TINT[accent] || KONVERZ_TINT_FALLBACK,
  designSets: KONVERZ_DESIGN_SETS,
  lookSets: KONVERZ_LOOK_SETS,
  defaultSet: "halo",

  pillars: KONVERZ_PILLARS,
  channels: { Harpreet: "#B52879", Lokesh: "#6B4FC9", "Konverz page": "#005382" },
  channelIds: KONVERZ_CHANNEL_IDS,
  profiles: KONVERZ_PROFILES,
  defaultChannel: "Konverz page",
  cadence: KONVERZ_CADENCE,
  template: KONVERZ_PLAN_TEMPLATE,
  templateVersion: KONVERZ_TMPL_V,

  core: KONVERZ_CORE,
  lanes: KONVERZ_LANES,
  detect: konverzDetect,
  laneFallback:
    "SUBJECT DISCIPLINE: choose ONE Konverz lane for this piece (Hire, Nurture, Coach, Learn, Skills AI, or The Layer) and stay strictly inside it. Do not blend modules into a feature list.",
  doNotAssert: DO_NOT_ASSERT_KONVERZ,
  marketScope:
    "Talent-acquisition leaders in BFSI and global capability centres, and CHROs and L&D heads in large enterprises, across India, the Philippines, Malaysia and the UAE. The subjects that move: hiring volumes and time-to-hire, application volumes and screening load, panel interviewing practice and interviewer consistency, campus and high-volume recruitment, assessment and psychometrics, candidate experience and drop-off, GCC headcount growth, succession and internal mobility, skills taxonomies, mentoring and coaching programmes, and learning spend and completion.",
  canonNumbers:
    "Konverz's own site-stated proof numbers (2k+ interviews completed, 60% reduction in time-to-hire, 35% enhanced candidate quality, 40% recruitment cost savings, 2x goal achievement, 45%+ skill-gap closure, 100% workforce twin), its psychometric evidence (test-retest ICC 0.96 against a 0.72 industry standard, Cronbach's alpha averaging 0.909), and the published customer results carried by their named speakers.",
  voiceHeader:
    "You write for Konverz AI, the AI-led talent intelligence layer for enterprise people decisions, used by TA leaders in BFSI and GCCs and by CHROs and L&D heads in large enterprises across India, the Philippines, Malaysia, and the UAE. Konverz is a product company: it speaks in outcomes, mechanisms, and proof, never in consulting abstractions. The audience is a leader deciding whether to bring the platform into their own hiring, mobility, coaching, or learning process.",
  writingBrief: `WRITE LIKE A PRODUCT LEADER SHOWING A CHRO WHAT ACTUALLY HAPPENS. Not a content marketer, not a brochure, not an AI.
- Every piece names at least one real mechanism: an AI assistant (Screen AI, Behavior AI, Tech AI, Interview Partner AI, Coach AI, Coaching Session Conferencing, AI Simulation, Skills AI), a journey step, a report, or a score. Say what the recruiter, mentee, or leader gets from it.
- Outcomes over adjectives: time removed, bias removed, decisions made with one profile instead of five tools, a plan generated instead of a form filled. Use the platform's stated numbers only where natural, and never invent one.
- The human gate is a feature: AI recommends, the recruiter or leader decides. Say it plainly when relevant.
- Speak to the buyer's process, not to "organizations": the campus drive, the RM hiring cycle, the succession review, the mentoring cohort.
- Declarative sentences. Short ones. Product nouns. Confidence without adjectives.
- In the headline, mark the pivotal word with *asterisks*; the gradient runs from that word to the end of the line, so place it where the promise begins ("Screening to *selection in one flow*").
- Every deck closes with an invitation to see it on the reader's own roles.`,
  vocabulary: `KONVERZ VOCABULARY, used only where genuinely apt: the Talent Intelligence Layer, JobFit AI, Cognitive Signatures, Behavior AI, Screen AI, Tech AI, Interview Partner AI, Coach AI, Skills AI, role fitment, job fit score, the workforce twin, human gates, "AI recommends, people decide", "Start the Konverzation", "Book a demo".`,
  // "journey" and "elevate" are on the shared banned list and are also Konverz's
  // own nouns: the Hire/Nurture/Coach/Learn journeys, "the full talent journey",
  // the Journey Map format, and the deck tagline "Elevating Talent Decisions".
  // Without this exemption the linter flags accurate product copy as slop and the
  // humanize pass is handed a list of non-problems to fix.
  allowedPhrases: ["journey", "elevate"],
  split: {
    left: "the OLD WAY of doing this",
    right: "how it works WITH KONVERZ",
    leftLabel: "The old way",
    rightLabel: "With Konverz"
  },
  readCloser: "The Konverz read",
  speaker: "Konverz",
  editVoice: "a product leader speaking to a CHRO",
  articleVoice: "a product leader writing personally, with the science behind it",
  exampleSource: "real implementations, anonymized unless the customer is named in company materials",
  checkerFor: "Konverz AI, a talent intelligence platform",
  formatGuide: {
      "Carousel": "Structure as mechanism to outcome. The cover states the decision the platform improves. Each content slide names one real thing (an assistant, a journey step, a report, a score) and what a TA leader or CHRO gets from it. One slide carries a proof number or a named-customer result from the ground truth. The last content slide is the sharpest product truth; the cta is a demo invitation on the reader's own roles.",
      "Square": "Same as Carousel: mechanism to outcome, one real thing per slide, a proof point, a demo invitation.",
      "Idea Deck": "Signals style: each Signal is a hiring, mobility, coaching, or learning failure the platform detects or prevents (junk applications, inconsistent panel interviews, potential judged from a nomination form, mentoring pairs that drift, skills nobody defined), and the body names the assistant or step that catches it. Book style: read the book for what it says about judging people, assessing, coaching, or learning, and let The Konverz read say where the platform measures what the book only asserts. Story style: a product-in-use story (a recruiter, a mentee, a CHRO); scenes are moments in the workflow, The read names what the data showed, The lesson is what the leader changed.",
      "Stat Card": "Only the platform's stated outcome numbers or figures verified via search. The body names the mechanism that removed the waiting or the bias.",
      "Says vs Does": "Left is the old process (keyword screening, panel-dependent interviews, potential from a nomination form, passive e-learning); right is the Konverz mechanism with the assistant or step named. Both sides concrete.",
      "Dialogue": "Speakers: a TA leader, CHRO, or L&D head asking the hard questions (bias, control, candidate experience, integration), and a speaker titled exactly \"Konverz\" answering with mechanisms and human gates, never slogans.",
      "Montage": "Three frames as three modules, three journey stages, three geographies, or three named customers; each frame one real thing and one outcome.",
      "Story": "One product moment in second person: a candidate finishing an AI interview at midnight on a phone, a recruiter reading one profile instead of five tools, a mentee's midpoint review showing the delta.",
      "Video": "Kinetic lines are outcomes and mechanisms in the product's own nouns; the last line is the demo invitation.",
      "Founder Video": "The founder explains one mechanism and why it exists, with one number or one named-customer result, and closes with the demo invitation. No feature lists.",
      "Article Cover": "An answer-shaped definition piece about the category or the science (talent intelligence layer, JobFit AI, behavioral assessment, Cognitive Signatures) that a CHRO could hand to a CIO.",
      "Feature Card": "The feature as the recruiter or leader experiences it, with only capabilities stated in the ground truth.",
      "Numbers Wall": "Four figures from the ground truth or verified search; labels say what each figure means for the process.",
      "Customer Quote": "Only published quotes and named speakers from the ground truth; otherwise an anonymized attribution stated as such.",
      "Journey Map": "Three real stages of a module's journey or the mentoring lifecycle, with real capabilities as chips.",
  },
  endCta: "Book a demo on your own roles"
};

export const BRANDS: Record<BrandId, Brand> = { kognoz: KOGNOZ, konverz: KONVERZ };

export const BRAND_IDS: BrandId[] = ["kognoz", "konverz"];

export const DEFAULT_BRAND_ID: BrandId = "kognoz";

export function isBrandId(v: unknown): v is BrandId {
  return v === "kognoz" || v === "konverz";
}

/** Never throws. An unknown id falls back to Kognoz, which is what shipped first. */
export function brandFor(id: unknown): Brand {
  return isBrandId(id) ? BRANDS[id] : BRANDS[DEFAULT_BRAND_ID];
}

/**
 * A storage key scoped to a brand.
 *
 * The existing Kognoz keys are already spelled "kognoz-calendar",
 * "kognoz-design", "kognoz-house-prefs", "kognoz-style-memory",
 * "kognoz-voice-samples" and "kognoz-source-material", so scoping by brand id
 * reproduces every one of them byte for byte. No migration, no data move: Konverz
 * simply reads keys that do not exist yet and gets empty blobs.
 */
export function brandKey(brand: Brand, name: string): string {
  return `${brand.id}-${name}`;
}
