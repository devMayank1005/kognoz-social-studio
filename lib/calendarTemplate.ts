// The rolling 30-day plan — ported verbatim from kognoz-social-studio-v3.jsx
// (PLAN_TEMPLATE + WEEK_OF + STATUS_NEXT/COLOR + TMPL_V + CHANNELS + DEFAULT).
// This is fixed editorial data agreed with the client, not something to
// regenerate — see README for why this was blocked until the jsx arrived.
import { C } from "./tokens";
import type { FormatId } from "./formats";
import type { DesignSetId } from "./designSets";

export const CHANNELS: Record<string, string> = { Lokesh: C.blue, Harpreet: C.teal, "Kognoz page": "#75A02F" };

export const TMPL_V = 2; // bump when the template changes; saved plans migrate, statuses survive

export interface PlanItem {
  n: number;
  day: number;
  ch: keyof typeof CHANNELS | string;
  fmt: FormatId | "Text post" | "Poll";
  set?: DesignSetId;
  style?: "signals" | "book" | "story"; // Idea Deck only
  pillar: string;
  topic: string;
  copy: string;
}

export const PLAN_TEMPLATE: PlanItem[] = [
  { n: 1, day: 1, ch: "Kognoz page", fmt: "Carousel", set: "editorial", pillar: "Behavioral Signal", topic: "Culture is what your people do, the signature thesis",
    copy: "Your culture is not what the survey says. It is what your people do between surveys. Eight slides on how we read it." },
  { n: 2, day: 1, ch: "Lokesh", fmt: "Text post", pillar: "Consulting POV", topic: "Why we built Kognoz at the intersection of AI, behavioral research, and consulting",
    copy: "HR tech reads data. Academics read behavior. Consultants give advice. We started Kognoz because the hardest people problems sit where all three meet, and almost no one stands there. Twelve years in, that is still the corner we work from." },
  { n: 3, day: 2, ch: "Lokesh", fmt: "Text post", pillar: "Behavioral Signal", topic: "The survey said empowered, while decisions travelled two levels up",
    copy: "A client's engagement survey said people felt ownership. Their decision logs said otherwise. Choices that belonged with managers were travelling two levels up before anyone would commit. The survey measured mood. The logs measured trust. We changed the structure, and the behavior followed." },
  { n: 4, day: 3, ch: "Kognoz page", fmt: "Stat Card", pillar: "Market Intelligence", topic: "India's 1,700+ GCCs and the internal mobility gap",
    copy: "India runs 1,700+ global capability centers. Most fill fewer than a quarter of open roles from inside. The capability you are hiring for is often already on payroll. The question is whether your systems can see it." },
  { n: 5, day: 3, ch: "Harpreet", fmt: "Founder Video", pillar: "Human + AI", topic: "Which decisions should AI never own in the people function",
    copy: "We put one rule inside everything we build. AI recommends, people decide. In this video, the decisions I believe AI should never own, and what happens to trust when that line goes fuzzy." },
  { n: 6, day: 4, ch: "Lokesh", fmt: "Says vs Does", pillar: "Behavioral Signal", topic: "Psychological safety, speak-up behavior versus trust scores",
    copy: "Trust scores were high. Speak-up behavior was near zero. When those two disagree, believe the behavior. It is the more expensive one to fake." },
  { n: 7, day: 4, ch: "Kognoz page", fmt: "Article Cover", pillar: "Behavioral Signal", topic: "How to measure culture through behavior, not surveys (Immersion Index article)",
    copy: "Culture you can measure. We wrote down how we do it. Five conditions, read through behavioral signals across the organization. The Immersion Index, in full, on our site." },
  { n: 8, day: 5, ch: "Harpreet", fmt: "Text post", pillar: "Human + AI", topic: "AI copilots without work redesign change nothing",
    copy: "Same decisions, same roles, same bottlenecks, now with a copilot attached. AI spend changes nothing until the work changes shape. That redesign is the actual project." },
  { n: 9, day: 8, ch: "Kognoz page", fmt: "Montage", pillar: "Consulting POV", topic: "Work changes, jobs change, structure follows",
    copy: "When the work changes, the jobs change. When the jobs change, the structure has to follow. Three frames on the sequence most transformations run backwards." },
  { n: 10, day: 8, ch: "Lokesh", fmt: "Text post", pillar: "From the Work", topic: "The org chart lies, influence sits where the founder's trust sits",
    copy: "In a family business the org chart tells you who reports to whom. It rarely tells you who decides. Influence sits where the founder's trust sits, and any redesign that ignores that map will be politely ignored back." },
  { n: 11, day: 9, ch: "Harpreet", fmt: "Carousel", set: "dark", pillar: "Human + AI", topic: "The Human-AI Work Spectrum, with one real example per zone",
    copy: "Every task in your organization sits somewhere between human-led and AI-led. Most leadership teams have never mapped where. The Human-AI Work Spectrum, with one real example per zone." },
  { n: 12, day: 10, ch: "Kognoz page", fmt: "Dialogue", pillar: "Human + AI", topic: "Can we just automate performance reviews, a real CHRO question",
    copy: "'Can we just automate performance reviews?' A CHRO asked us this last quarter. Our answer, in one short exchange." },
  { n: 13, day: 10, ch: "Lokesh", fmt: "Founder Video", pillar: "Behavioral Signal", topic: "The one question I ask every leadership team first",
    copy: "Before any diagnostic, I ask leadership teams one question. The answer usually tells me more than the survey that follows. It is in the video." },
  { n: 14, day: 11, ch: "Harpreet", fmt: "Poll", pillar: "Human + AI", topic: "Who should own AI adoption in the people function: HR, IT, or the business",
    copy: "AI is entering the people function either way. The open question is who owns it. I have seen three answers work and two fail. Where does it sit in your organization?" },
  { n: 15, day: 11, ch: "Kognoz page", fmt: "Carousel", set: "magazine", pillar: "From the Work", topic: "A 150,000-person job architecture, the case story",
    copy: "150,000 people. One job architecture. The same work carried different titles across dozens of countries until the enterprise agreed on one logic for every role, level, and family. The case, in six slides." },
  { n: 16, day: 12, ch: "Lokesh", fmt: "Idea Deck", style: "book", pillar: "Behavioral Signal", topic: "The Culture Code by Daniel Coyle, reviewed for CEOs",
    copy: "We read The Culture Code the way we read organizations: for the behavior underneath the stories. Seven ideas worth stealing, one question worth debating, and where our practice agrees with the book and where it argues. A book review for people who run companies, not book clubs. Swipe." },
  { n: 17, day: 15, ch: "Kognoz page", fmt: "Video", pillar: "Consulting POV", topic: "Structure is a science",
    copy: "Structure is a science. Eight seconds on the idea we build every reorganization on." },
  { n: 18, day: 15, ch: "Harpreet", fmt: "Text post", pillar: "Human + AI", topic: "What an agent running the workflow actually means, and the human gates",
    copy: "An agent running your HR workflow sounds simple until you ask what it is authorized to decide. The real design work is in the gates, where the agent stops and a human signs." },
  { n: 19, day: 16, ch: "Harpreet", fmt: "Stat Card", pillar: "Human + AI", topic: "The poll result and the pattern behind it",
    copy: "Two hundred of you answered. The pattern surprised me less than the comments did. Here is the number, and what I read in it." },
  { n: 20, day: 16, ch: "Lokesh", fmt: "Says vs Does", pillar: "From the Work", topic: "Succession: 'he'll be ready in two years' versus what decisions actually leave the founder's desk",
    copy: "'He will be ready in two years.' Meanwhile no decision above a threshold has left the founder's desk in eighteen months. Readiness is not a date. It is a transfer of real decisions, visible in the logs." },
  { n: 21, day: 17, ch: "Kognoz page", fmt: "Article Cover", pillar: "Human + AI", topic: "Redesigning work for humans and AI, the spectrum that decides what AI should own",
    copy: "What should AI own in your organization? We wrote down the framework we use to decide, zone by zone. The Human-AI Work Spectrum, in full, on our site." },
  { n: 22, day: 17, ch: "Lokesh", fmt: "Idea Deck", style: "signals", pillar: "Behavioral Signal", topic: "Spot the signal: five behaviors, one early warning",
    copy: "Five behaviors we keep meeting in leadership teams, anonymized. One of them is the early warning most leaders miss until the exit interviews. The Ask card holds the question; the answer is one swipe further. Tell me in the comments which one you picked before you swiped." },
  { n: 23, day: 18, ch: "Lokesh", fmt: "Text post", pillar: "Behavioral Signal", topic: "The signal most of you missed, and why",
    copy: "Yesterday's deck asked which of five behaviors was the early warning. Most answers picked the loud one, the conflict in the room. The signal was the quiet one: the meeting where dissent stopped showing up. Conflict means people still believe the room can change something. Silence means they have stopped trying. Silence arrives before attrition does, usually by two quarters. That gap is where retention is won." },
  { n: 24, day: 18, ch: "Kognoz page", fmt: "Story", pillar: "Behavioral Signal", topic: "Vertical cut of the week's sharpest insight",
    copy: "The week's sharpest signal, in thirty seconds." },
  { n: 25, day: 19, ch: "Lokesh", fmt: "Text post", pillar: "Human + AI", topic: "AI recommends, people decide, as an engineering constraint inside Konverz",
    copy: "Inside Konverz, 'AI recommends, people decide' is an access-control rule, written into the architecture. The model cannot write a promotion, a rating, or an exit. That constraint shaped the whole build, and it is why leaders trust the output." },
  { n: 26, day: 22, ch: "Kognoz page", fmt: "Montage", pillar: "Market Intelligence", topic: "Three forces reshaping talent in the Gulf",
    copy: "Vision 2030 timelines. Nationalization targets. Skills-first models replacing title hierarchies. Three forces reshaping talent across the Gulf, and what each demands from leadership." },
  { n: 27, day: 22, ch: "Lokesh", fmt: "Founder Video", pillar: "From the Work", topic: "What 50,000 leadership assessments taught us about potential",
    copy: "Fifty thousand leadership assessments taught us one uncomfortable thing about potential. Most processes measure polish and call it readiness. Ninety seconds in the video." },
  { n: 28, day: 23, ch: "Harpreet", fmt: "Carousel", set: "glass", pillar: "Human + AI", topic: "Reinventing HR around AI, lessons from implementation",
    copy: "We rebuilt an enterprise HR function around AI. A third of its effort moved from processing to strategy. The lessons that survived contact with reality, in six slides." },
  { n: 29, day: 24, ch: "Kognoz page", fmt: "Dialogue", pillar: "From the Work", topic: "My son isn't ready, readiness versus release in family business",
    copy: "'My son isn't ready.' We hear this in most succession conversations. Sometimes it is true. Often it means something else. One exchange from the room." },
  { n: 30, day: 24, ch: "Harpreet", fmt: "Text post", pillar: "Market Intelligence", topic: "Skills-first hiring, the behavioral evidence on what predicts performance",
    copy: "Degrees tell you where someone started. Behavior tells you what they will do next. The evidence behind skills-first hiring keeps pointing the same way." },
  { n: 31, day: 25, ch: "Harpreet", fmt: "Founder Video", pillar: "Human + AI", topic: "The jobs don't disappear, they change shape",
    copy: "The jobs do not disappear. They change shape. Ninety seconds against both the hype and the doom." },
  { n: 32, day: 25, ch: "Kognoz page", fmt: "Carousel", set: "bloom", pillar: "Behavioral Signal", topic: "The Immersion Index, five conditions of a culture that performs",
    copy: "Purpose. Ownership. Mastery. Trust. Wellbeing. Five conditions we read in behavior rather than surveys, and the two that usually move first. In six slides." },
  { n: 33, day: 26, ch: "Lokesh", fmt: "Idea Deck", style: "story", pillar: "From the Work", topic: "Inside a founder-family alignment conversation",
    copy: "A succession conversation, told the way it happened, anonymized. Three scenes, one turn, and the moment the business plan stopped mattering. Frameworks do not carry that weight; we stay in the room for it anyway. If you are a founder reading scene two and recognizing your own table, that is the point." },
  { n: 34, day: 29, ch: "Kognoz page", fmt: "Stat Card", pillar: "Market Intelligence", topic: "The month in one number",
    copy: "The month, in one number. Chosen from what landed hardest with you." },
  { n: 35, day: 29, ch: "Harpreet", fmt: "Text post", pillar: "Consulting POV", topic: "One month of posting what we believe, what your responses showed us",
    copy: "One month of posting what we actually believe. Your responses taught us as much as the writing did. Three things I did not expect, below." },
  { n: 36, day: 30, ch: "Kognoz page", fmt: "Article Cover", pillar: "Consulting POV", topic: "Newsletter edition one, the month's three best ideas",
    copy: "Edition one. The month's three strongest ideas, the two long reads, and what we are watching next. Subscribe if people, behavior, and AI is your problem too." }
];

export const WEEK_OF = (d: number): string =>
  d <= 5 ? "Week 1 · Arrival" : d <= 12 ? "Week 2 · Depth" : d <= 19 ? "Week 3 · Interaction" : d <= 26 ? "Week 4 · Authority" : "Month-end";

export type ItemStatus = "Planned" | "Drafted" | "Posted";
export const STATUS_NEXT: Record<ItemStatus, ItemStatus> = { Planned: "Drafted", Drafted: "Posted", Posted: "Planned" };
export const STATUS_COLOR: Record<ItemStatus, string> = { Planned: "#939598", Drafted: "#43AFCD", Posted: "#75A02F" };

// Default example content (a Behavioral Signal carousel) so the tool opens populated.
export const DEFAULT_CONTENT = {
  eyebrow: "Behavioral Signal",
  cover: "Culture is what your people *do*",
  slides: [
    { title: "The survey and the behavior disagree", body: "Your engagement score says people own their work. Meanwhile decisions that belong two levels down are landing on your desk for sign-off." },
    { title: "Behavior is the honest data", body: "What people report once a year and what they do every week are different facts. We measure the second one." },
    { title: "The cause is usually structural", body: "Watch the behavior and the problem is rarely attitude. Decision rights, spans, and consequences are set up to push everything upward. Structures can be redesigned." },
    { title: "Read it with the Immersion Index", body: "Five conditions, read through behavioral signals across the organization. You see what is happening and which two changes matter most." }
  ],
  cta: "See how we read culture"
};

export interface Plan {
  month: number;
  tmplV: number;
  history: { month: number; posted: number; of: number }[];
  items: (PlanItem & { status: ItemStatus })[];
}
