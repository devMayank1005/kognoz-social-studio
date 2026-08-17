// BRAND_CORE + Practice Lanes + lane detector — ported verbatim from
// kognoz-social-studio-v3.jsx (§6.1/§6.2 in the PRD). Injected into every
// fresh generation and caption. Do not paraphrase — this is the firm's
// ground-truth language, agreed with the client.

export const BRAND_CORE = `KOGNOZ GROUND TRUTH (canon; from the firm's website):
Positioning: "Your people are your strategy." Kognoz helps organizations across India, the Middle East, and Southeast Asia unlock what their people are capable of, through culture, talent, and organization consulting built on behavioral science and scaled by AI.
Method: We measure behavior, not opinion. Every organizational problem shows up first as behavior, long before it reaches a dashboard.
Augmented Intelligence(TM): behavioral science, scaled by AI, with people always making the call. AI recommends; a human always decides.
Proof: 650,000+ jobs architected, 50,000+ leadership assessments, 200+ enterprises, 12 countries. Konverz AI is the firm's talent platform.`;

export type PracticeLane = "culture" | "talent" | "org" | "aiwork" | "family";

// The practices are distinct lanes on the site; content must respect that.
// Each lane carries its own frameworks and vocabulary, and names what it must
// NOT borrow, because blended-practice content reads as generic consulting.
export const PRACTICE_LANES: Record<PracticeLane, string> = {
  culture: `THIS PIECE LIVES IN THE CULTURE LANE.
In-lane concepts: the Immersion Index(TM) and its five conditions (Purpose, Ownership, Mastery, Trust, Wellbeing); behavior vs survey ("engagement scores look fine, but the energy is gone"); psychological safety read through speak-up behavior ("people nod in the room, then nothing changes"); what teams do under pressure; rituals, recognition, and manager behavior as culture's transmission mechanism.
OFF-LIMITS here (they belong to other practices): org structure, decision rights, spans and layers, Decision Architecture (Organization Design); succession depth and bench strength (Talent & Leadership); AI adoption mechanics and the Work Spectrum (Human + AI Work Design); founder and family dynamics (Family Business).`,
  talent: `THIS PIECE LIVES IN THE TALENT & LEADERSHIP LANE.
In-lane concepts: succession depth and bench strength ("when a key person resigns, there's no one ready"); readiness and time-to-ready; hidden high performers invisible to managers; leadership assessment through behavior; regretted attrition without early warning; nationalization pipelines (Saudization, Emiratization); internal mobility.
OFF-LIMITS here: the Immersion Index conditions and culture diagnosis (Culture); org structure and decision rights (Organization Design); AI work redesign and the Spectrum (Human + AI Work Design); family governance (Family Business).`,
  org: `THIS PIECE LIVES IN THE ORGANIZATION DESIGN LANE.
In-lane concepts: Decision Architecture (structure matched to the weight of decisions, authority pushed to where the work is); decision rights and accountability ("everything needs three sign-offs and nobody feels accountable"); operating models that the business has outgrown; spans, layers, and job architecture.
OFF-LIMITS here: engagement, psychological safety, and the Immersion Index (Culture); succession and assessments (Talent & Leadership); the Human-AI Work Spectrum (Human + AI Work Design); family power structures (Family Business).`,
  aiwork: `THIS PIECE LIVES IN THE HUMAN + AI WORK DESIGN LANE.
In-lane concepts: the Human-AI Work Spectrum (human-led, human + AI together, AI-led) with trust thresholds per decision type; task decomposition; work redesigned around what people and AI each do best ("you bought the AI, but nothing about how work happens changed"); AI-led HR reinvention; adoption as behavior change, not training.
OFF-LIMITS here: deep culture diagnosis and the Immersion Index detail (Culture); succession and bench (Talent & Leadership); full org restructuring language (Organization Design); family dynamics (Family Business).`,
  family: `THIS PIECE LIVES IN THE FAMILY BUSINESS LANE.
In-lane concepts: the lived power structure vs the org chart ("the org chart says one thing; real authority sits elsewhere"); succession as a transfer of real decisions, not a date; generational alignment; governance that respects legacy while professionalizing; the founder's weight in every room.
OFF-LIMITS here: corporate frameworks quoted cold (the Spectrum, the Index) unless translated into family language; generic HR vocabulary.`
};

// Detector — keyword routing on the topic, priority order matters:
// family -> org -> talent -> aiwork -> culture -> general fallback.
// PRD §16 unit test: "internal mobility ... AI skills" must route talent, not aiwork.
export function laneContext(topicText: unknown): string {
  const t = String(topicText || "").toLowerCase();
  let lane: PracticeLane | null = null;
  if (/family|founder|promoter|next.?gen|generational|patriarch|legacy/.test(t)) lane = "family";
  else if (
    /organi[sz]ation|org design|structure|decision right|operating model|span|layer|job architecture|sign.?off|accountab/.test(
      t
    )
  )
    lane = "org";
  else if (
    /talent|succession|bench|readiness|assessment|leadership pipeline|attrition|retention|hiring|mobility|hipo/.test(t)
  )
    lane = "talent";
  else if (/\bai\b|agent|automation|copilot|spectrum|augmented|technology|reinvent.*hr|hr.*ai/.test(t)) lane = "aiwork";
  else if (/culture|engag|immersion|psycholog|safety|ritual|values|behavio/.test(t)) lane = "culture";

  if (!lane)
    return `SUBJECT DISCIPLINE: choose ONE Kognoz practice lens for this piece (Culture, Talent & Leadership, Organization Design, Human + AI Work Design, or Family Business) and stay strictly inside it. Do not blend frameworks from different practices.`;
  return (
    PRACTICE_LANES[lane] +
    `\nSUBJECT DISCIPLINE: stay strictly inside this lane. Do not import the off-limits concepts. If the topic genuinely touches a second practice, keep this lane primary and give the other at most one closing sentence that names it as adjacent work.`
  );
}
