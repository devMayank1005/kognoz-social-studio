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

export type ChannelId = "Kognoz page" | "Konverz page" | "Lokesh" | "Harpreet";

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

/**
 * The Kognoz table. Partial over ChannelId because "Konverz page" is not a Kognoz
 * channel — the product has its own page — and every lookup here goes through
 * `voiceFor`, which falls back rather than indexing blind.
 */
export const FOUNDER_PROFILES: Partial<Record<ChannelId, FounderProfile>> = {
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
export const KONVERZ_CHANNEL_IDS: ChannelId[] = ["Konverz page", "Lokesh", "Harpreet"];

/**
 * Every channel id either brand publishes under.
 *
 * Used for VALIDATION only, never for display. A voice sample filed under
 * "Konverz page" has to survive `coerceSamples` even while Kognoz is the loaded
 * brand, or switching brands would silently drop half the corpus on the next
 * save. Which ids a person is actually offered comes from the brand.
 */
export const ALL_CHANNEL_IDS: ChannelId[] = ["Kognoz page", "Konverz page", "Lokesh", "Harpreet"];

/**
 * The same three people, publishing for the product rather than the firm.
 *
 * Lokesh and Harpreet appear in both tables on purpose. They hold different jobs
 * at the two companies — he is a Kognoz co-founder and Konverz's CEO, she is a
 * Kognoz co-founder and Konverz's Chief Business Officer — and they are credible
 * about different things in each seat. One merged profile would have a Konverz
 * post arguing organization design, which is the firm's work and not the
 * product's.
 *
 * Roles and topics come from Konverz_Website_Inputs.md and the leadership pages
 * already cited in `evidence` above; nothing new was researched for this table.
 */
export const KONVERZ_PROFILES: Partial<Record<ChannelId, FounderProfile>> = {
  "Konverz page": {
    id: "Konverz page",
    publicName: "Konverz AI",
    role: "The product page — institutional voice",
    voice:
      "the Konverz AI company page. Institutional voice: we/our, product-confident, mechanism-first. States what the platform does and what it produced, never what it believes.",
    evidencedTopics: [
      "the Talent Intelligence Layer as a category: one decision engine across candidates, employees and learners",
      "the eight AI assistants by name, and what each one removes from a process",
      "the Hire, Nurture, Coach and Learn journeys end to end",
      "the Candidate Role Fitment Comprehensive Report and the Job Fit score",
      "psycholinguistics and Cognitive Signatures as the measurement method",
      "psychometric evidence: ICC 0.96 test-retest, Cronbach's alpha averaging 0.909",
      "published customer results, attached to the named speaker who gave them",
      "integrations and partners: Darwinbox, Cornerstone, Giift, Persistent, PeopleStrong",
      "ISO 27001 and SOC compliance"
    ],
    suitsFormats: ["Carousel", "Numbers Wall", "Customer Quote", "Journey Map", "Feature Card", "Stat Card", "Montage"],
    evidence: ["https://konverz.ai/", "Konverz AI 2026 solutions deck", "Konverz_Website_Inputs.md"]
  },

  Lokesh: {
    id: "Lokesh",
    publicName: "Lokesh Nigam",
    role: "Founder & CEO, Konverz AI; Co-Founder & Director, Kognoz",
    voice:
      "Lokesh, founder and CEO of Konverz AI, writing in the first person. Home ground: why the platform is built the way it is. Language as a computational proxy for thought, Cognitive Signatures, the decision to build the science layer before the product layer, and where he insists a human keeps the call. I/we, direct, specific, never a brand account.",
    evidencedTopics: [
      "conversational AI in hiring and in internal talent decisions",
      "psycholinguistics and behavioral science as the measurement layer under the product",
      "why the science layer, not the model layer, is the defensible one",
      "AI as augmentation rather than control, and where the human gates belong",
      "assessment design: the 10-question behavioral and domain model",
      "building a product company out of a consulting practice",
      "sector-specific hiring problems: BFSI, GCCs, manufacturing, pharma, IT"
    ],
    suitsFormats: ["Text post", "Founder Video", "Idea Deck", "Article Cover", "Dialogue", "Says vs Does"],
    evidence: [
      "https://theenterpriseworld.com/lokesh-nigam-ceo-of-konverz-ai/",
      "https://kognozconsulting.com/team/lokesh-nigam/"
    ],
    note: "Named CEO of Konverz AI in a published interview, so a first-person product voice is a continuation of something real."
  },

  Harpreet: {
    id: "Harpreet",
    publicName: "Harpreet Kaur Kapoor",
    role: "Chief Business Officer, Konverz AI; Co-Founder & Practice Leader, Kognoz",
    voice:
      "Harpreet, Chief Business Officer of Konverz AI, writing in the first person. Home ground: what happens when the platform meets a real hiring or development process. Deployment, adoption, what a TA team changes on Monday, what an L&D head sees in the dashboard three months in. An implementation-tested voice: what actually happened when we rolled it out. I/we, direct, specific, never a brand account.",
    evidencedTopics: [
      "AI in talent acquisition, from screening through to offer",
      "talent assessment and job design",
      "learning and talent development, and the mentoring program lifecycle",
      "career and learning marketplaces, internal mobility",
      "HR transformation and large-scale change in ASEAN specifically",
      "psychometrics as assessment craft",
      "what adoption looks like in behavior rather than in licence counts"
    ],
    suitsFormats: ["Text post", "Founder Video", "Poll", "Feature Card", "Journey Map", "Carousel", "Dialogue"],
    evidence: [
      "https://kognozconsulting.com/team/harpreet-kapoor/",
      "https://in.linkedin.com/in/harpreet-kaur-kapoor-3a442b1b"
    ],
    note:
      "Her public footprint is speaking appearances rather than published writing, so a first-person voice for her is new territory. Her posts are the ones most worth reading closely before they go out."
  }
};

/**
 * Konverz claims that must never appear. Sourced from Konverz_Website_Inputs.md
 * §5 and §6, which set the attribution rules the client agreed to.
 */
export const DO_NOT_ASSERT_KONVERZ: string[] = [
  'Never write "Konverze". The product is "Konverz AI" (konverz.ai).',
  "Never name a customer who is not already named in company materials. The published list is Petronas, Vedanta (Sterlite Copper), Sobha Realty, Coca-Cola, Bharti AXA, APL Apollo, Tata Play Fiber, XLRI, Steel Strips Wheels, Zelestra, Sime Darby Property, Philip Morris International, Thapar Institute, Essem Group, Prasarana and Tynor. Anyone else is described by shape, not by name.",
  "Never attach a customer result to the company alone. A quoted outcome carries the named speaker who gave it: Dr. Niza at Petronas, Dr. Munish Kumar Thakur at XLRI, Pankaj Sharma at APL Apollo, Dhanashree Thakkar at Bharti AXA Life. Without the speaker, the claim does not go out.",
  "Never interchange the parameter counts. 90+ is the number of behavioral dimensions in the science. 180+ is XLRI's own words about their deployment. 200+ is what Behavior AI assesses. Each belongs only in its own context.",
  "Never invent a proof number. The site-stated set is the whole set: 2k+ interviews completed, 60% reduction in time-to-hire, 35% enhanced candidate quality, 40% recruitment cost savings, 2x goal achievement, 45%+ skill-gap closure, 100% workforce twin.",
  "Never describe a capability the ground truth does not state. The eight assistants and their listed capabilities are the boundary; a plausible-sounding feature is still an invented one.",
  "Never claim a market or office beyond India, the Philippines, Malaysia and the UAE. Offices are Gurugram, Kuala Lumpur and Makati City.",
  "Never name, quote or compare against a competing vendor."
];

/**
 * The voice line for a channel.
 *
 * Falls back to the table's own company page, NOT to a founder. The old inline
 * ternary in buildCaptionPrompt sent every unrecognised channel to Harpreet —
 * including "LinkedIn", which is the quick-add default — so a post nobody assigned
 * came out in a real person's first-person voice. An institutional fallback is
 * wrong in a way that is merely bland.
 *
 * `profiles` defaults to the Kognoz table so every existing caller is unchanged.
 */
export function voiceFor(
  channel: string,
  profiles: Partial<Record<ChannelId, FounderProfile>> = FOUNDER_PROFILES,
  fallback: ChannelId = "Kognoz page"
): string {
  const hit = profiles[channel as ChannelId] || profiles[fallback];
  // Last resort, if a caller hands in a table with no company page at all. Bland
  // and institutional on purpose: the failure mode to avoid is a post nobody
  // assigned coming out in a named person's first-person voice.
  return hit?.voice ?? "the company page. Institutional voice: we/our, calm authority, evidence-led.";
}

/** The month's cadence, matching the hand-written plan the team already runs. */
export const CADENCE = {
  postsPerMonth: 36,
  weekdaysOnly: true,
  /** Roughly half the working days carry two posts. */
  perChannel: { "Kognoz page": 14, Lokesh: 12, Harpreet: 10 } as Partial<Record<ChannelId, number>>
};

/**
 * Konverz's split, counted off the 36-item plan in lib/konverzTemplate.ts.
 * The product page carries more of the load than the Kognoz page does, because
 * mechanism and proof posts belong to the platform rather than to a person.
 */
export const KONVERZ_CADENCE = {
  postsPerMonth: 36,
  weekdaysOnly: true,
  perChannel: { "Konverz page": 18, Harpreet: 10, Lokesh: 8 } as Partial<Record<ChannelId, number>>
};
