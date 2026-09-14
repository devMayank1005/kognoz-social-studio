// The Konverz AI month-1 plan — 36 items, ported from
// social-studio-v4-kognoz-konverz.jsx (KONVERZ_TEMPLATE).
//
// Same shape as PLAN_TEMPLATE in lib/calendarTemplate.ts, and it seeds
// /calendar the same way, but its provenance is NOT the same and the difference
// matters.
//
// #############################################################################
// # THE `copy` FIELDS HERE WERE WRITTEN BY A MODEL, NOT BY A PERSON.          #
// #                                                                           #
// # They are a starting draft for the Write-> button, nothing more. They must  #
// # NEVER be fed into the voice-sample corpus. lib/voiceSamples.ts exists      #
// # because this app once learned its voice from its own output — every export #
// # filed the deck under "APPROVED EXAMPLES ... match their voice", so each    #
// # generation copied the last one's machine voice. Seeding the corpus from    #
// # here would rebuild that loop with extra steps.                             #
// #                                                                           #
// # samplesFromTemplate() in lib/voiceSamples.ts is gated to Kognoz for this   #
// # reason, and lib/voiceSamples.test.ts pins the gate. If the client later    #
// # reviews and approves this copy, lift the gate THERE and say so HERE.       #
// #############################################################################
import type { PlanItem } from "./calendarTemplate";

/** Bumped past the Kognoz template's version; saved plans migrate, statuses survive. */
export const KONVERZ_TMPL_V = 5;

export const KONVERZ_PLAN_TEMPLATE: PlanItem[] = [
  { n: 1, day: 1, ch: "Konverz page", fmt: "Carousel", set: "dark", pillar: "How It Works", topic: "What a Talent Intelligence Layer actually is, in six slides",
    copy: "Every HR stack has tools. Very few have a layer underneath that connects them into one decision engine. Konverz AI is that layer: Role Intelligence, People Intelligence, Decision Intelligence on a single talent data spine. Six slides on what changes when hiring, mobility, and learning stop being separate products." },
  { n: 2, day: 1, ch: "Harpreet", fmt: "Text post", pillar: "Talent Intelligence POV", topic: "Why we built a layer instead of five products",
    copy: "Most HR tech is tooling stacked on foundation models. When the models commoditize, the tooling does too. We built Konverz AI on decades of behavioral research first and the platform second. The science layer is the part nobody can copy with a model upgrade. That order was deliberate." },
  { n: 3, day: 2, ch: "Lokesh", fmt: "Text post", pillar: "Talent Intelligence POV", topic: "What 180 behavioral parameters see that a resume cannot",
    copy: "A resume tells you where someone has been. A two-way conversational interview, read across 180+ behavioral and domain parameters, tells you how they think under a question they did not expect. JobFit AI was built to read the second thing. Hiring decisions get better when both are on the table." },
  { n: 4, day: 3, ch: "Konverz page", fmt: "Numbers Wall", pillar: "Outcome Proof", topic: "The four numbers behind Hire, and the one behind the science",
    copy: "2k+ interviews completed. 60% reduction in time-to-hire. 35% enhanced candidate quality. 40% cost savings in recruitment. And one more from the lab rather than the field: test-retest reliability of 0.96 against an industry standard of 0.72. The scoreboard, then the reason it holds." },
  { n: 5, day: 3, ch: "Harpreet", fmt: "Founder Video", pillar: "How It Works", topic: "Screening to selection in one flow: the five steps, in ninety seconds",
    copy: "Screen AI, Interview AI, Tech AI, Interview Partner AI, Candidate Profile and Reports. Five steps, one candidate record, no handoffs between tools. Ninety seconds on how a hiring journey looks when the recruiter keeps final say and the busywork disappears." },
  { n: 6, day: 4, ch: "Lokesh", fmt: "Says vs Does", pillar: "Talent Intelligence POV", topic: "The old way of screening versus what behavioral screening actually sees",
    copy: "Screening the old way ranks keywords. Behavioral screening ranks fit. The card shows both sides of the same candidate pool. The difference is not speed, though speed follows. The difference is who gets through." },
  { n: 7, day: 4, ch: "Konverz page", fmt: "Article Cover", pillar: "Talent Intelligence POV", topic: "What is a Talent Intelligence Layer? The definition and why it matters",
    copy: "A definition piece. What a talent intelligence layer is, what it is not, and how it differs from an HCM, an ATS, or a learning platform. Written so a CHRO can hand it to a CIO and both come away with the same picture." },
  { n: 8, day: 5, ch: "Harpreet", fmt: "Feature Card", pillar: "How It Works", topic: "Interview AI: the two-way conversational interview",
    copy: "Not a chatbot with questions in a queue. A two-way interview that adapts to what the candidate says and reads 200+ parameters across behavior, communication, and domain. Campus or experienced hiring, any device, any language. Here is what the recruiter gets back." },
  { n: 9, day: 8, ch: "Konverz page", fmt: "Montage", pillar: "Outcome Proof", topic: "Three organizations, three hiring problems, one layer",
    copy: "Petronas turned passive learning into an engaging growth experience. Bharti AXA transformed hiring with Hire. Vedanta assessed leadership readiness at scale during transformation. Three panels, three different problems, one intelligence layer underneath." },
  { n: 10, day: 8, ch: "Lokesh", fmt: "Text post", pillar: "Talent Intelligence POV", topic: "AI with empathy is not a slogan, it is a technical choice",
    copy: "Most AI reads what people do. Natural-language understanding built on psycholinguistics reads why they do it. That is the difference between a score and an insight, and it is why our platform flags disengagement, burnout, and mismatch before the exit interview does. Empathy here is an engineering decision." },
  { n: 11, day: 9, ch: "Harpreet", fmt: "Carousel", set: "glasslight", pillar: "How It Works", topic: "Hire, end to end: what each step does and what it hands to the next",
    copy: "Screen AI filters at volume. Interview AI reads fit. Tech AI tests skill with assessments generated fresh for every candidate. Interview Partner AI sits with the recruiter live. Reports bring it together. One carousel, the whole chain, and what stays human at the end of it." },
  { n: 12, day: 10, ch: "Konverz page", fmt: "Stat Card", pillar: "Outcome Proof", topic: "60% faster hiring: what that number is made of",
    copy: "Sixty percent less time-to-hire is not one trick. It is screening at volume without manual sorting, interviews that run when the candidate is ready, assessments that arrive already scored, and a recruiter who reads one profile instead of five tools. The number is the sum of removed waiting." },
  { n: 13, day: 10, ch: "Lokesh", fmt: "Founder Video", pillar: "Talent Intelligence POV", topic: "Language is a computational proxy for thought: the science under JobFit",
    copy: "Ninety seconds on the idea the whole platform rests on. How people use language reveals how they think, and that can be measured: Cognitive Signatures, numerical representations of thought derived from linguistic data. Test-retest reliability 0.96 where the industry standard is 0.72. That is the moat." },
  { n: 14, day: 11, ch: "Harpreet", fmt: "Poll", pillar: "Market Intelligence", topic: "Where does your hiring budget actually go: assessment vendors, RPOs, recruitment partners, or internal effort?",
    copy: "Honest question for TA and HR leaders. Of every hundred rupees you spend getting a role filled, where does most of it go? Assessment vendors, RPOs and recruitment partners, or your own team's hours. We are collecting this because the answer decides which part of the process to fix first." },
  { n: 15, day: 11, ch: "Konverz page", fmt: "Customer Quote", pillar: "Customer Story", topic: "XLRI: 180+ parameters and a 30 to 40 percent faster selection",
    copy: "Dr. Munish Kumar Thakur, Dean Academics at XLRI, on using Konverz AI for IEV Quest admissions: candidates assessed on 180+ parameters, detailed and accurate profiles, selection time reduced by 30 to 40 percent. Admissions is hiring with the stakes turned up. The mechanics are the same." },
  { n: 16, day: 12, ch: "Lokesh", fmt: "Idea Deck", style: "book", pillar: "Talent Intelligence POV", topic: "Talent, reviewed: a book on judgment, read through JobFit",
    copy: "A book stash on how people actually judge other people, read against what behavioral assessment sees. Seven ideas worth keeping, one Ask worth debating, and where the platform agrees with the author and where it argues." },
  { n: 17, day: 15, ch: "Konverz page", fmt: "Carousel", set: "glasslight", pillar: "How It Works", topic: "Eight AI assistants, one talent layer: what each one does",
    copy: "Screen AI, Behavior AI, Tech AI, Interview Partner AI, Coach AI, Coaching Session Conferencing, AI Simulation, Skills AI. Eight assistants, each with a narrow job, all writing to one talent record. A carousel that names what each does and what it hands to the next." },
  { n: 18, day: 15, ch: "Harpreet", fmt: "Text post", pillar: "How It Works", topic: "Human gates are not a compromise, they are the product",
    copy: "AI recommends; a human decides who gets hired, moved, or developed. Every step in the platform ends at a person with full control over the final call. That is not a limitation we accepted. It is the design principle the whole layer was built around, and it is why CHROs let it near their people decisions." },
  { n: 19, day: 16, ch: "Harpreet", fmt: "Stat Card", pillar: "Market Intelligence", topic: "The poll result: where the hiring wallet actually goes",
    copy: "The result of last week's poll on hiring spend. Most of the budget leaves the building before an internal decision is made. The card shows the split and what it implies about which part of the process to fix first." },
  { n: 20, day: 16, ch: "Lokesh", fmt: "Says vs Does", pillar: "Talent Intelligence POV", topic: "What high potential looks like on a form versus in a conversation",
    copy: "On a nomination form, high potential is a manager's adjective. In a structured conversation read across behavioral parameters, it is a pattern: how the person reasons under ambiguity, what they do with a question they did not expect. The card shows both. Nurture is built to surface the second." },
  { n: 21, day: 17, ch: "Konverz page", fmt: "Article Cover", pillar: "Talent Intelligence POV", topic: "What is JobFit AI? Behavioral fit, domain fit, and how the two combine",
    copy: "A definition piece for the engine. What JobFit AI measures, why behavioral fit and domain fit are scored separately and read together, and what 180+ parameters means in practice. Written for a leader deciding whether the science is real." },
  { n: 22, day: 17, ch: "Lokesh", fmt: "Idea Deck", style: "signals", pillar: "Talent Intelligence POV", topic: "Spot the mis-hire: five interview behaviors, one predicts the exit",
    copy: "Five behaviors from real interviews, anonymized. One of them predicts an early exit more reliably than the rest. The Ask card holds the question; the answer is one swipe on. Tell me which you picked before you swiped." },
  { n: 23, day: 18, ch: "Lokesh", fmt: "Text post", pillar: "Talent Intelligence POV", topic: "The behavior most of you missed, and why the loud one fools us",
    copy: "Yesterday's deck asked which of five interview behaviors predicts an early exit. Most picked the confident answer that went slightly wrong. The signal was the quiet one: the candidate who never asked what the role actually involved. Curiosity about the work is the tell. Confidence is noise." },
  { n: 24, day: 18, ch: "Konverz page", fmt: "Story", pillar: "Customer Story", topic: "Petronas: assessing HR Business Partners with tailored development journeys",
    copy: "Vertical story. Dr. Niza, Head of Learning Strategy and Performance, Global L&D at Petronas, on assessing HR Business Partners on behavioral and technical competencies, situational case studies, individual development plans, and reduced potential bias. Competency assessment that became development planning." },
  { n: 25, day: 19, ch: "Harpreet", fmt: "Carousel", set: "halo", pillar: "How It Works", topic: "A 12-month mentoring program, run by the platform: month by month",
    copy: "Onboarding and pairing in month zero. AI discovery and a personalized plan in month one. Monthly mentoring with pre-session briefings and post-session feedback through month five. A midpoint AI review at six. Cumulative reports and cohort analytics at twelve. The lifecycle as run at Vedanta Sterlite Copper, with nudges and escalation running underneath." },
  { n: 26, day: 22, ch: "Konverz page", fmt: "Montage", pillar: "Market Intelligence", topic: "India, Philippines, Malaysia, UAE: four talent markets, one layer",
    copy: "Three-panel montage on the geographies where Konverz AI operates. Different hiring pressures, different skills gaps, the same need for decisions grounded in behavior rather than resumes. Offices in Gurugram, Kuala Lumpur, and Manila." },
  { n: 27, day: 22, ch: "Lokesh", fmt: "Founder Video", pillar: "Talent Intelligence POV", topic: "What thousands of behavioral assessments taught us about potential",
    copy: "The patterns that repeat when you read potential through behavior rather than reputation, and the two things managers most often get wrong about their own high performers. Ninety seconds, straight to camera." },
  { n: 28, day: 23, ch: "Harpreet", fmt: "Carousel", set: "module", pillar: "How It Works", topic: "Nurture: career paths, skills intelligence, and mobility before the exit",
    copy: "From talent management to talent movement. How Nurture maps career paths, reads skills across the workforce, and surfaces internal moves before a good person starts answering recruiter messages. Predictive, not retrospective." },
  { n: 29, day: 24, ch: "Konverz page", fmt: "Feature Card", pillar: "How It Works", topic: "Tech AI: technical assessment that adapts to the candidate",
    copy: "MCQs, live coding in any language, concept explanation, conversational case studies, situational judgment. Generative AI builds a fresh assessment for each of thousands of candidates, proctored, in under thirty minutes. AI comments on key traits so the recruiter reads a judgment, not just a score." },
  { n: 30, day: 24, ch: "Harpreet", fmt: "Text post", pillar: "Market Intelligence", topic: "Skills-first hiring needs a skills engine, not a slogan",
    copy: "Everyone agrees skills should outrank degrees. Almost nobody has a way to extract, define, and score skills at the moment a role opens. Skills AI generates the requirement from a job description in seconds and carries it through screening. The slogan becomes a process. That is the whole point." },
  { n: 31, day: 25, ch: "Harpreet", fmt: "Founder Video", pillar: "How It Works", topic: "Learn: from passive content to development that shows up in behavior",
    copy: "Ninety seconds on the Learn side of the platform. AI-guided development priorities, mentor matching, learning nudges in the flow of work, and growth tracked as behavior change rather than completions. The transformation engine, explained plainly." },
  { n: 32, day: 25, ch: "Konverz page", fmt: "Carousel", set: "dark", pillar: "Talent Intelligence POV", topic: "The 90+ behavioral dimensions we read, and why five families",
    copy: "Personality across OCEAN. Social dynamics. Emotions, from admiration to non-emotion. Cognition, including how people orient in time. Drives: affiliation, achievement, risk, power, reward. Ninety-plus parameters in five families, read from language. A carousel on what each family predicts." },
  { n: 33, day: 26, ch: "Lokesh", fmt: "Idea Deck", style: "story", pillar: "Customer Story", topic: "Inside a leadership readiness assessment during a transformation",
    copy: "A story stash. Three scenes from an assessment run at scale while the organization was being restructured, one turn, the read, and the lesson. Anonymized, told the way it happened. If you have run a transformation, scene two will feel familiar." },
  { n: 34, day: 29, ch: "Konverz page", fmt: "Customer Quote", pillar: "Customer Story", topic: "Bharti AXA Life: recruiters focused on decisions, not manual steps",
    copy: "Dhanashree Thakkar, CHRO at Bharti AXA Life Insurance, on Hire: assessments that give clear insight, recruiters focused on the right decisions, use across teams and levels, and hires who fit the role and the culture. Her words, in a card." },
  { n: 35, day: 29, ch: "Harpreet", fmt: "Text post", pillar: "Talent Intelligence POV", topic: "One month of posting what we build. What the questions told us.",
    copy: "We posted the platform for a month, plainly. The most common question was not about features. It was whether the behavioral layer is real or marketing. It is real, and the best proof is a demo on your own roles. Start the Konverzation." },
  { n: 36, day: 30, ch: "Konverz page", fmt: "Article Cover", pillar: "Product Update", topic: "Release notes, month one: what shipped and why it matters",
    copy: "The first monthly digest of what shipped across Hire, Nurture, and Learn, written for the people who use it every day. What changed, what it fixes, and what is next. Delivered as an article, archived in the library." }
];
