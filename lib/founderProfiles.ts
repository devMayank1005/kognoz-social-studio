// Who each publishing identity is, and what they can credibly post about.
//
// Researched from public sources on 1 Sep 2026 and written down ONCE, deliberately. The
// alternative — searching the web on every generation — costs several times as much per
// run, is slower, and puts unreviewed facts about real people straight into a calendar
// nobody checked first. Written down, the facts get corrected once and are then free
// forever.
//
// EDIT THIS FILE when something is wrong or out of date. It steers what gets written in
// these people's names, so being wrong here is worse than being thin here.
//
// Everything below is either taken from a source named in `evidence`, or from voice
// definitions that already existed in this codebase. `DO_NOT_ASSERT` is as load-bearing
// as the rest: those are things research could NOT confirm, and a confident claim about a
// real firm is a reputational cost, not a style problem.

export type ChannelId = "Kognoz page" | "Lokesh" | "Harpreet";

export interface FounderProfile {
  id: ChannelId;
  /** Full name as they publish under it. */
  publicName: string;
  role: string;
  /** The voice instruction. Lifted from buildCaptionPrompt so both prompts share one source. */
  voice: string;
  /** Subject matter each has publicly spoken or written about. Safe ground. */
  evidencedTopics: string[];
  /** Formats that suit how this identity actually publishes. */
  suitsFormats: string[];
  /** Where the evidence came from, so a future reader can re-check rather than re-research. */
  evidence: string[];
  /** Anything worth knowing when judging output in this voice. */
  note?: string;
}

/**
 * Claims research could not verify. These must never appear in generated content.
 *
 * Each line is here because a search actively failed to confirm it, not because nobody
 * looked.
 */
export const DO_NOT_ASSERT: string[] = [
  'Never write "the Immersion Index". The phrase has no public footprint connected to Kognoz — every public hit is unrelated (microscopy, acoustics). What is real and public: IMMERSE (the Kognoz + Giift engagement platform), Kognoz Culture Studio, and Lokesh\'s article "Kognoz Immersive Engagement".',
  "Never state a founding year for Kognoz. Public sources conflict between 2015 and 2018.",
  'Never say Kognoz has "two co-founders". There are three — Manish Prasad is listed as Co-Founder | Director alongside Lokesh and Harpreet on the firm\'s own leadership page.',
  "Never claim a Middle East office or Middle East market presence. Verified offices are Gurugram, Kuala Lumpur and Makati City. Say India and Southeast Asia.",
  "Never name a client. Kognoz's public material describes clients only by shape (a Fortune 200 company, a USD 10bn FMCG enterprise) and names none.",
  'The product is spelled "Konverz AI" (konverz.ai). Never "Konverze".',
  "Never attribute an external statistic to a named report unless it has been verified. The firm's own proof numbers may be stated as Kognoz's own."
];

export const FOUNDER_PROFILES: Record<ChannelId, FounderProfile> = {
  "Kognoz page": {
    id: "Kognoz page",
    publicName: "Kognoz Research & Consulting",
    role: "The company page — institutional voice",
    voice:
      "the Kognoz company page. Institutional voice: we/our, calm authority, evidence-led.",
    evidencedTopics: [
      "culture transformation grounded in self-determination theory — shared purpose, shared values, autonomy at work, requisite skills, unconditional collaboration",
      "employee experience design",
      "organization design and leadership development",
      "learning in the flow of work",
      "skills architecture: Skillmaps, skill ontologies, talent exchange",
      "HCM platform enablement — Darwinbox, Cornerstone OnDemand, Workday",
      "behavioural and organizational science as the method: measuring what people do, not what they say",
      "delivery across India and Southeast Asia"
    ],
    suitsFormats: ["Carousel", "Stat Card", "Article Cover", "Montage", "Square", "Idea Deck"],
    evidence: [
      "https://kognozconsulting.com/",
      "https://kognozconsulting.com/capabilities/culture-transformation/",
      "https://kognozconsulting.com/skillmaps/",
      "https://in.linkedin.com/company/kognozconsulting"
    ]
  },

  Lokesh: {
    id: "Lokesh",
    publicName: "Lokesh Nigam",
    role: "Co-Founder & Director, Kognoz; Founder & CEO, Konverz AI; visiting faculty at XLRI Jamshedpur",
    voice:
      "Lokesh, Kognoz co-founder, writing in the first person. Home ground: behavioral science, AI, and technology, and how organizations actually change when you measure behavior and build AI around human judgment. Writes from the intersection: what people do, what the data shows, what the technology makes possible. I/we, direct, specific, never a brand account.",
    evidencedTopics: [
      "intrinsic motivation and flow at work — autonomy, competence, purpose",
      "AI and applied behavioural science together, as augmentation rather than control",
      "conversational AI in hiring and internal talent decisions",
      "organization transformation, org design and digital HR transformation",
      "strategic workforce planning and leadership development",
      "the Future Work Axis themes: digital enablement, distributed leadership, embedded learning, employee and network well-being, glocal citizenship",
      "organizational mindfulness",
      "Requisite Organization and Appreciative Inquiry as working methods",
      "sector-specific people problems: oil and gas, manufacturing, pharma, BFSI, IT, family-led enterprises"
    ],
    suitsFormats: ["Text post", "Founder Video", "Idea Deck", "Article Cover", "Says vs Does", "Dialogue"],
    evidence: [
      "https://kognozconsulting.com/team/lokesh-nigam/",
      "https://kognozconsulting.com/kognoz-immersive-engagement-and-the-flow-revolution-empowering-the-future-of-work-with-ai-and-applied-behavioral-science/",
      "https://ccap.ph/speaker/lokesh-nigam/",
      "https://theenterpriseworld.com/lokesh-nigam-ceo-of-konverz-ai/"
    ],
    note:
      "He has a published article and several interviews, so a written first-person voice is a continuation of something real. 22 years in consulting; prior to Kognoz, roles at KPMG, PwC and Aon Hewitt."
  },

  Harpreet: {
    id: "Harpreet",
    publicName: "Harpreet Kaur Kapoor",
    role: "Co-Founder & Practice Leader, Kognoz; CEO, Kognoz Talent Solutions; Chief Business Officer, Konverz AI",
    voice:
      "Harpreet, Kognoz co-founder, writing in the first person. Home ground: technology and HR transformation, specifically AI-led HR transformation: the HR function redesigned around AI, agentic workflows with human gates, HCM implementation, adoption that shows up in behavior not logins. An implementation-tested practitioner voice: what actually happened when we built it. I/we, direct, specific, never a brand account.",
    evidencedTopics: [
      "HR transformation and organization design",
      "learning and development, and the changing paradigm in the learning and talent space",
      "talent management, talent assessment and job design",
      "career and learning marketplaces",
      "employee engagement and well-being",
      "talent consulting in the ASEAN region specifically",
      "psychometrics and transactional analysis as assessment craft",
      "AI in talent acquisition",
      "large-scale organization change"
    ],
    suitsFormats: ["Text post", "Founder Video", "Poll", "Dialogue", "Says vs Does", "Carousel"],
    evidence: [
      "https://kognozconsulting.com/team/harpreet-kapoor/",
      "https://kognozconsulting.com/about/our-leadership/",
      "https://in.linkedin.com/in/harpreet-kaur-kapoor-3a442b1b"
    ],
    note:
      "Her public footprint is speaking appearances and company promotion — research found no article or post published under her byline. A first-person writing voice for her is new territory rather than a continuation, so her posts are the ones most worth reading closely before they go out."
  }
};

export const CHANNEL_IDS: ChannelId[] = ["Kognoz page", "Lokesh", "Harpreet"];

/**
 * The voice line for a channel.
 *
 * Falls back to the company page, NOT to a founder. The old inline ternary in
 * buildCaptionPrompt sent every unrecognised channel to Harpreet — including "LinkedIn",
 * which is the quick-add default — so a post nobody assigned came out in a real person's
 * first-person voice. An institutional fallback is wrong in a way that is merely bland.
 */
export function voiceFor(channel: string): string {
  const hit = FOUNDER_PROFILES[channel as ChannelId];
  return (hit || FOUNDER_PROFILES["Kognoz page"]).voice;
}

/** The month's cadence, matching the hand-written plan the team already runs. */
export const CADENCE = {
  postsPerMonth: 36,
  weekdaysOnly: true,
  /** Roughly half the working days carry two posts. */
  perChannel: { "Kognoz page": 14, Lokesh: 12, Harpreet: 10 } as Record<ChannelId, number>
};
