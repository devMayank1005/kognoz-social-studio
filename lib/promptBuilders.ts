// Prompt builders — the actual text sent to Claude per task, ported verbatim
// from kognoz-social-studio-v3.jsx (generate(), writeCopy(), writeArticle(),
// verifyFacts(), modifyContent(), applyDesignNote()). Split out from the
// React state management so the prompt text itself is reviewable and
// (where it matters) testable on its own.
import { BRAND_CORE, laneContext } from "./brandCore";
import { FOUNDER_PROFILES, CHANNEL_IDS, DO_NOT_ASSERT, CADENCE, voiceFor } from "./founderProfiles";
import type { FormatId } from "./formats";
import type { CoercedSlide } from "./coerce";

export interface StyleExample {
  format: string;
  cover: string;
  slides: CoercedSlide[];
  cta: string;
}

export type IdeaStyle = "signals" | "book" | "story";

// ---------------------------------------------------------------------------
// generate() — deck/single-asset content generation.
// ---------------------------------------------------------------------------
export interface GenerateOpts {
  topic: string;
  pillar: string;
  format: FormatId;
  ideaStyle?: IdeaStyle;
  housePrefs?: string;
  styleMem?: StyleExample[];
  fresh?: boolean;
  /**
   * Explicit opt-in/out for web-search grounding. Grounding costs several times a
   * plain generation ($10/1000 searches plus every result billed as input tokens),
   * so it must be a visible choice rather than an invisible consequence of picking
   * a format. Omitted -> falls back to `groundingDefault`.
   */
  grounded?: boolean;
}

/**
 * Formats and pillars where grounding is usually the right call. This is only the
 * DEFAULT state of the toggle now, not a silent trigger.
 */
export function groundingDefault(format: FormatId, pillar: string): boolean {
  return format === "Stat Card" || format === "Montage" || pillar === "Market Intelligence";
}

export function buildGeneratePrompt(opts: GenerateOpts): { prompt: string; useSearch: boolean } {
  const { topic: gTopic, pillar: gPillar, format: gFormat, ideaStyle = "signals", housePrefs = "", styleMem = [], fresh, grounded } = opts;

  const prefBlock = housePrefs.trim()
    ? `\nSTANDING TEAM PREFERENCES, learned from earlier edits. Apply proactively:\n${housePrefs.trim()}\n`
    : "";
  const relevantMem = styleMem.filter((e) => e.format === gFormat).slice(-2);
  const memPick = relevantMem.length ? relevantMem : styleMem.slice(-1);
  const memBlock =
    fresh || !memPick.length
      ? ""
      : `\nAPPROVED EXAMPLES the team finalized earlier. Match their voice, compression, and specificity, not their topic:\n${memPick
          .map((e) => JSON.stringify(e))
          .join("\n")}\n`;
  const freshBlock = fresh
    ? `\nFRESH REGENERATION: earlier drafts on this topic were rejected. Take a genuinely different angle: a different hook, a different structure, different evidence, a different pivotal *word* in the cover. Do not repeat phrasing or slide logic from any earlier attempt.\n`
    : "";

  const prompt = `You write for Kognoz, a people-consulting firm for CEOs, CHROs, promoters, and business owners across India, the Middle East, and Southeast Asia. Kognoz reads what people and organizations actually do, through behavioral science and AI, and turns it into decisions leaders can trust. The audience is senior executives deciding who to bring in on their hardest people problems.

${BRAND_CORE}

${laneContext(gTopic)}

WRITE LIKE A SENIOR PARTNER SPEAKING TO A CEO. Not a content marketer, not an analyst, not an AI.
- Speak to consequences leaders own: growth that stalls, succession that is not real, a culture quietly working against the strategy, AI spend that changes nothing.
- Behavioral language always: name what people do ("decisions travel two levels up before anyone commits"), never feelings-jargon ("people don't feel empowered").
- Evidence in every piece: a defensible number, an observed behavior, or an anonymized moment from real client work. Kognoz has architected 650,000+ jobs and run 50,000+ leadership assessments across 200+ enterprises; use scale like this only where it is natural.
- Declarative sentences. Short ones. Specific nouns. Confidence without adjectives.
- In the headline, mark exactly ONE pivotal word or two-word phrase with *asterisks*; it renders in the Kognoz gradient. Choose the word that carries the argument.

BANNED. If any of these appear, the output is wrong:
- "not just", "isn't just", "it's about", "the key is", "here's the thing", "let that sink in", "read that again", "imagine", "picture this", "in today's world", "in a world where", "game-changer", "game changing", "unlock", "leverage", "seamless", "journey", "navigate", "landscape", "dive", "delve", "robust", "holistic", "elevate", "revolutionize", "supercharge", "cutting-edge", "synergy", "harness", "foster", "realm", "tapestry"
- Em dashes anywhere. Colons in headlines ("X: the Y of Z"). Rhetorical-question hooks. Exclamation marks. Emojis. Hashtags.
- Hedging: "we believe", "in our view", "arguably", "perhaps", "may well".
- Symmetric constructions ("Get X right and... get it wrong and..."). Triads for rhythm ("faster, smarter, better").
- Never name, quote, or knock competitors, vendors, or "most consultants". Kognoz states what it sees and does.

KOGNOZ VOCABULARY, used only where genuinely apt: behavioral signals, the Immersion Index, the Human-AI Work Spectrum, job architecture, decision rights, succession depth, talent intelligence, "AI recommends, people decide."

NEVER include a URL or web address in any field. The site address is rendered separately as a fixed design element on the slide.

CRAFT RULES:
- Cover: 8 words or fewer, sentence case, one concrete tension.
- Slide titles are claims of 4 to 7 words ("The survey and the behavior disagree"), never labels ("Introduction", "The problem").
- Every slide body carries one specific detail: a number, an observed behavior, or a named mechanism.
- No two slides restate the same point. The final content slide carries the sharpest takeaway, the one worth saving.
- Draft first, then audit your draft against BANNED and these rules, fix every violation, and only then return the final JSON.
${prefBlock}${memBlock}${freshBlock}
${buildFormatBlock(gFormat, gTopic, gPillar, ideaStyle)}`;

  const LINE_RULE = `\nLINE STRUCTURE, ALL FORMATS: when a body carries distinct statements, separate each with a real line break (\\n inside the JSON string): the claim on its own line, a capability line on its own line, "Source: <title, year>" on its own line. Never run distinct statements into one sentence.`;
  const needsGrounding = typeof grounded === "boolean" ? grounded : groundingDefault(gFormat, gPillar);
  const groundedPrompt = needsGrounding
    ? prompt +
      LINE_RULE +
      `\n\nGROUNDING, NON-NEGOTIABLE: use the web_search tool to verify any statistic BEFORE stating it. State only numbers you can actually see in search results, and cite them as "Source: <the actual publication and year you found>". If you cannot verify a number, write the insight without a number and with no source line. Never cite a report from memory; a wrong source printed on a slide costs the firm its credibility.\nSEARCH BUDGET: you have at most 2 searches. Spend them on the load-bearing numbers, the ones a reader would challenge. Write the rest of the piece from the brief, without numbers, rather than spending a search to decorate a slide.`
    : prompt +
      LINE_RULE +
      `\n\nSOURCES: do not attach named external reports or statistics from memory. The firm's own proof numbers may be stated as Kognoz's. Any external figure must appear without a source line (the team verifies separately with the Verify facts button).`;

  return { prompt: groundedPrompt, useSearch: needsGrounding };
}

function buildFormatBlock(gFormat: FormatId, gTopic: string, gPillar: string, ideaStyle: IdeaStyle): string {
  switch (gFormat) {
    case "Article Cover":
      return `Write the cover for a Kognoz long-form article on this topic: "${gTopic}" (pillar: "${gPillar}"). This is a WIDE 16:9 editorial cover, not a social card: a headline plus a standfirst that makes a reader commit to the piece.
Return ONLY valid JSON: {"eyebrow": "${gPillar}", "cover": "the article headline, sharp and specific, max ~80 characters", "slides": [{"title": "-", "body": "the standfirst: two or three sentences on separate lines joined with \\n. Line 1 names the tension the article resolves. Line 2 says what the reader will be able to do differently. Optional line 3 carries the evidence or scale. Max ~300 chars total."}], "cta": "the reading promise, e.g. a six-minute read on what the behaviour shows, max ~60 chars, NO URL"}
The standfirst is the only body copy on the page and it fills the width beside the headline. Write it to be read, not skimmed.`;
    case "Stat Card":
      return `Create a single-statistic card on this topic: "${gTopic}" (pillar: "${gPillar}").
Return ONLY valid JSON: {"eyebrow": "${gPillar}", "cover": "-", "slides": [{"title": "THE NUMBER ALONE, max 10 characters, e.g. 1,700+ or 1 in 3 or 30%", "body": "two or three SEPARATE lines joined with \\n: line 1 = the claim in one plain sentence, no source in it; line 2 = one Kognoz or Konverz capability sentence only if it genuinely fits; line 3 = Source: <publication, year> ONLY if verified via search this session"}], "cta": "a short closing line, max ~50 chars, NO source, NO URL"}
The title must contain nothing but the figure. The body must NOT restate the figure; it says what the figure means. One sentence per line. Em dashes and en dashes are forbidden everywhere; write separate short sentences instead.`;
    case "Says vs Does":
      return `Create a "Says vs Does" contrast card on this topic: "${gTopic}" (pillar: "${gPillar}"). This is Kognoz's signature: the gap between what people or surveys SAY and what behavior actually SHOWS.
Return ONLY valid JSON: {"eyebrow": "${gPillar}", "cover": "a headline naming the gap, max ~70 chars", "slides": [{"title": "What the survey says", "body": "the reported belief, first person or survey voice, max ~110 chars"}, {"title": "What behavior says", "body": "the observed behavior that contradicts it, max ~110 chars"}], "cta": "one-line takeaway, max ~60 chars, NO URL"}`;
    case "Dialogue":
      return `Write a short, real-feeling exchange between a business leader and Kognoz on this topic: "${gTopic}" (pillar: "${gPillar}"). The leader asks or asserts; Kognoz answers with the sharp, evidence-led reframe. 4 to 5 messages, alternating, ending on Kognoz.
Return ONLY valid JSON: {"eyebrow": "${gPillar}", "cover": "a short scene-setting heading, max ~60 chars", "slides": [{"title": "Leader", "body": "their line, max ~120 chars"}, {"title": "Kognoz", "body": "our line, max ~140 chars"}], "cta": "one-line takeaway, max ~50 chars, NO URL"}`;
    case "Montage":
      return `Create a 3-frame montage on this topic: "${gTopic}" (pillar: "${gPillar}"). One big headline spans all three frames.
You have EXACTLY three frames and no more, so the three together must carry the COMPLETE argument — not three disconnected observations. Frame 1 sets up the tension. Frame 2 develops it with the evidence or mechanism. Frame 3 lands the takeaway a leader acts on. Someone reading only these three frames should feel they have the whole piece.
Return ONLY valid JSON: {"eyebrow": "${gPillar}", "cover": "the spanning headline, 6-12 words, big and declarative — it is broken into three phrases, one per frame, so write something that still reads when revealed a few words at a time", "slides": [{"title": "2-4 word title for the setup", "body": "the setup, in full sentences, max ~200 chars"}, {"title": "2-4 word title for the development", "body": "the evidence or mechanism, max ~200 chars"}, {"title": "2-4 word title for the takeaway", "body": "what a leader does with it, max ~200 chars"}], "cta": "one-line close, max ~50 chars, NO URL"} — exactly 3 slides.
Each frame is a large panel on a 3240px-wide canvas. Write the full ~200 characters for each; a one-line body leaves the frame looking unfinished.
The three frames are swiped in order and are designed to read as one continuous piece, so the headline is laid across them a phrase at a time. Fewer than six words leaves the last frames bare; more than twelve crowds the panels.`;
    case "Story":
      return `Write a vertical 9:16 story card on this topic: "${gTopic}" (pillar: "${gPillar}"). This is a tall frame read top to bottom in a few seconds, so it needs a small arc, not one stray sentence.
Return ONLY valid JSON: {"eyebrow": "${gPillar}", "cover": "a bold short headline, max ~55 chars", "slides": [{"title": "-", "body": "three short paragraphs on separate lines joined with \\n. Line 1 is the hook that stops the scroll. Line 2 develops it with the behaviour, number or mechanism. Line 3 is the thought worth screenshotting. Max ~420 chars total."}], "cta": "a short next step, max ~40 chars, NO URL"}
The three lines fill the vertical frame. One short line leaves most of the card empty.`;
    case "Founder Video":
      return `Write a 60-90 second talking-head video script for a Kognoz co-founder to record, on this topic: "${gTopic}" (pillar: "${gPillar}"). It must sound like a real person speaking, not a brand. First person, direct, one core insight, evidence or a real (anonymized) example in the middle, and a closing point of view. No hedging, no jargon.
Return ONLY valid JSON: {"eyebrow": "${gPillar}", "cover": "the video's working title / on-screen hook, max ~60 chars", "slides": [{"title": "Hook · 0-8s", "body": "the spoken opening line(s) that earn the next 10 seconds, max ~160 chars"}, {"title": "Setup · 8-25s", "body": "frame the tension or misconception, spoken, max ~200 chars"}, {"title": "Insight · 25-55s", "body": "the core point with the evidence or example, spoken, max ~240 chars"}, {"title": "Close · 55-80s", "body": "the point of view + one question to the viewer, spoken, max ~160 chars"}], "cta": "the LinkedIn caption to post with the video: 2-3 sharp lines plus one question, max ~280 chars"}`;
    case "Video":
      return `Write a kinetic-typography video sequence on this topic: "${gTopic}" (pillar: "${gPillar}"). The headline animates in word by word, then each beat below is REVEALED in turn on screen.
This is a sequence, not a card. Write 4 beats that build: the opening claim, the tension or misconception, the evidence or mechanism, then the turn a leader should take. Each beat is spoken-weight text meant to land on its own frame, so write short declarative lines, not paragraphs. Separate distinct statements inside a beat with \\n so they reveal line by line.
Return ONLY valid JSON: {"eyebrow": "${gPillar}", "cover": "the animated headline, max 9 words, punchy", "slides": [{"title": "-", "body": "beat 1, the opening claim, max ~180 chars"}, {"title": "-", "body": "beat 2, the tension, max ~180 chars"}, {"title": "-", "body": "beat 3, the evidence or mechanism, max ~180 chars"}, {"title": "-", "body": "beat 4, the turn, max ~180 chars"}], "cta": "a short close, max ~40 chars, NO URL"} — exactly 4 slides.
Do not pad. Every beat must carry a real idea; if a beat has nothing to say, make the argument sharper rather than longer.`;
    case "Idea Deck":
      if (ideaStyle === "book")
        return `Create a book-review idea deck for: "${gTopic}" (pillar: "${gPillar}"). Kognoz reviews books for CEOs and CHROs through a behavioral-science lens: what the book gets right about people and organizations, and what a leader should do with it on Monday morning.
Return ONLY valid JSON: {"eyebrow": "${gPillar}", "cover": "the book's core claim in plain words, max 7 words, NOT the title", "slides": [7 cards], "cta": "the book title and author, max ~50 chars"}
Cards in order: kickers "Idea 01" through "Idea 04", each body one idea from the book translated into an action or a behavioral read (max ~110 chars); then exactly "Ask" (a question the book forces on a leadership team) and "Reveal" (the book's answer, sharpened); then a final card with kicker exactly "The Kognoz read" whose body says where the book meets, or misses, what we see in real organizations.`;
      if (ideaStyle === "story")
        return `Tell a true-feeling, fully anonymized client story as an idea deck about: "${gTopic}" (pillar: "${gPillar}"). Concrete, restrained, no names, no invented statistics; the drama lives in behavior.
Return ONLY valid JSON: {"eyebrow": "${gPillar}", "cover": "the story's hook, max 7 words", "slides": [6 cards], "cta": "the one-line moral, max ~50 chars, NO URL"}
Cards in order: kickers "Scene 01", "Scene 02", "Scene 03" (each body a concrete moment, max ~110 chars); then "The turn" (the moment things shifted); then "The read" (what the behavior actually revealed); then "The lesson" (what a leader should take from it).`;
      return `Create an idea deck on this topic: "${gTopic}" (pillar: "${gPillar}"). Style: atomic idea cards, one self-contained insight per card, each strong enough to screenshot alone. Exactly one Ask card followed immediately by its Reveal card, placed mid-deck, to pull the swipe.
Return ONLY valid JSON: {"eyebrow": "${gPillar}", "cover": "the deck title, max 6 words", "slides": [6 or 7 cards, each {"title": kicker, "body": "one atomic idea, max ~110 chars"}], "cta": "a closing line, max ~50 chars, NO URL"}
Kickers in order: "Signal 01", "Signal 02", ... , with the pair titled exactly "Ask" then "Reveal" in the middle. The Ask body is a genuine question a CHRO would debate; the Reveal body answers it with evidence.`;
    default:
      return `Write a LinkedIn ${gFormat === "Carousel" ? "carousel" : "square carousel"} for the content pillar "${gPillar}" on this topic: "${gTopic}".
Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{"eyebrow": "${gPillar}", "cover": "a sharp cover hook, max ~85 characters", "slides": [{"title": "3-6 word slide title", "body": "one idea, max ~180 characters"}], "cta": "a closing line for the deck, plain words, max ~60 characters, NO URL"}
Provide ${gFormat === "Carousel" ? "5 to 6" : "3 to 4"} slides.`;
  }
}

// ---------------------------------------------------------------------------
// writeCopy() — the calendar caption engine (LinkedIn post text per item).
// ---------------------------------------------------------------------------
export function buildCaptionPrompt(opts: {
  channel: "Kognoz page" | "Lokesh" | "Harpreet" | string;
  fmt: string;
  topic: string;
  currentCopy?: string;
  instruction?: string;
  housePrefs?: string;
}): string {
  const { channel, fmt, topic, currentCopy = "", instruction = "", housePrefs = "" } = opts;
  const isText = fmt === "Text post";
  const isPoll = fmt === "Poll";
  const lengthSpec = isText
    ? "This IS the complete LinkedIn post, not a caption. 90 to 150 words. A first line that earns the second. Short paragraphs separated by line breaks. One idea, evidence in the middle, a pointed close or one genuine question."
    : isPoll
    ? "This is a LinkedIn poll. Write 2 or 3 framing lines, then a line starting with POLL: holding the question, then 3 or 4 answer options on separate lines, each under 28 characters."
    : "Short and crisp: 2 to 5 short lines, under 70 words total. It accompanies the visual asset.";
  const prefBlock = housePrefs.trim() ? `\nSTANDING TEAM PREFERENCES, learned from earlier edits. Apply proactively:\n${housePrefs.trim()}\n` : "";
  const revBlock =
    instruction && instruction.trim()
      ? `\nCURRENT DRAFT:\n${currentCopy || ""}\n\nREVISION INSTRUCTION FROM THE TEAM: "${instruction.trim()}"\nRevise the draft to follow the instruction. Keep what already works; do not start from scratch unless the instruction demands it.\n`
      : "";
  // One definition per voice, shared with the calendar planner so the two cannot drift.
  // This replaced a ternary whose final branch was the DEFAULT: every channel that was
  // not "Kognoz page" or "Lokesh" got Harpreet's first-person voice, including
  // "LinkedIn", which is the quick-add default. Posts nobody assigned to her were being
  // written as her. voiceFor falls back to the company page instead.
  const who = voiceFor(channel);

  return `Write the LinkedIn post text for ${who}

Kognoz is a people-consulting firm for CEOs, CHROs, and business owners across India, the Middle East, and Southeast Asia. It reads what people and organizations actually do, through behavioral science and AI, and turns it into decisions leaders can trust.
${instruction && instruction.trim() ? "" : BRAND_CORE + "\n\n" + laneContext(topic)}

The post accompanies this asset: format "${fmt}", topic "${topic}".

RULES:
- ${lengthSpec}
- Insightful: one real idea, stated plainly, with a behavior, number, or observed moment where natural.
- Behavioral language, never feelings-jargon. Declarative sentences. Confidence without adjectives.
- BANNED: "not just", "isn't just", "it's about", "the key is", "here's the thing", "imagine", "unlock", "leverage", "seamless", "journey", "navigate", "delve", "game-changer", "elevate", "robust", "holistic". No em dashes, no rhetorical-question hooks, no exclamation marks, no emojis, no hashtags, no hedging ("we believe", "arguably"). Never mention competitors.
LINE STRUCTURE: when a body carries distinct statements, separate each with a real line break (\\n in the JSON string): the claim on its own line, then "Source: <report name, year>" on its own line if a source exists, then a Kognoz capability line on its own line if one belongs. Never run distinct statements together into one sentence. Sources must be real and stated only when known; never invent one.
- End with either a pointed closing line or one genuine question, never "thoughts?" or "agree?".
${prefBlock}${revBlock}
Return ONLY the post text, nothing else — no JSON, no quotation marks around it.`;
}

// ---------------------------------------------------------------------------
// writeArticle() — the Article Cover long-form writer (PRD §10).
// ---------------------------------------------------------------------------
export function buildArticlePrompt(opts: { topic: string; pillar: string; instruction?: string; currentArticle?: string }): string {
  const { topic, pillar, instruction, currentArticle } = opts;
  const revBlock =
    instruction && instruction.trim() && currentArticle
      ? `\nCURRENT ARTICLE:\n${currentArticle}\n\nREVISION INSTRUCTION: "${instruction.trim()}"\nApply it precisely; keep everything the instruction doesn't touch. Return the full revised article.`
      : "";
  return `Write the full LinkedIn article behind this cover: "${topic}" (pillar: "${pillar}").

${BRAND_CORE}

${laneContext(topic)}

SHAPE:
- 900 to 1200 words in markdown: one # title, 4 to 6 ## section heads, short paragraphs of 2 to 4 sentences. At most one short list in the whole piece.
- The first two sentences are the hook readers see before clicking: a claim or a tension, never throat-clearing.
- The opening section answers the core question in plain words within the first 150 words, phrased so precisely that an AI answer engine could quote it as the definition.
- One anonymized example from real consulting work. No client names. No invented statistics and NO named external reports or sources from memory; only the firm's stated proof numbers may carry attribution (as Kognoz's own). Leave external figures out rather than guessing.
- A section leaders can act on this quarter: concrete first moves, not principles.
- Close with one line inviting conversation and the site: kognozconsulting.com
VOICE: a senior partner writing personally. Declarative sentences. Behavioral language, never feelings-jargon. Specific over general.
BANNED: "not just", "isn't just", "it's about", "the key is", "here's the thing", "imagine", "unlock", "leverage", "seamless", "journey", "navigate", "delve", "game-changer", "elevate", "robust", "holistic", em dashes, rhetorical-question hooks, exclamation marks, emojis, hashtags, hedging ("we believe", "arguably"). Never mention competitors.
${revBlock}
Return ONLY the article markdown, nothing else.`;
}

// ---------------------------------------------------------------------------
// verifyFacts() — the credibility firewall's Verify pass (PRD §9).
// ---------------------------------------------------------------------------
export function buildVerifyPrompt(content: { eyebrow: string; cover: string; slides: CoercedSlide[]; cta: string }): string {
  const current = JSON.stringify(content);
  return `You are the fact-checker for Kognoz, a consulting firm. Check the numeric claims, statistics, named reports, and source lines in this social content against the live web using the web_search tool. A wrong or invented source printed on a slide costs the firm its credibility.

CONTENT: ${current}

SEARCH BUDGET: you have at most 2 searches, so triage before you spend them. Rank the claims by how much damage a wrong one would do — a named external report or a precise statistic outranks a round directional number — and search the top ones. Batch related claims into a single query where one search can settle several. A claim you did not have budget to check is "unverifiable", not "verified"; say so in its note. Kognoz's own proof numbers (650,000+ jobs, 50,000+ assessments, 200+ enterprises, 12 countries) are canon and never need a search.

For each factual claim: search where budget allows, then judge. Return ONLY JSON:
{"checks": [{"where": "cover" | "slide N" | "cta", "claim": "the claim as written", "verdict": "verified" | "wrong" | "unverifiable", "note": "what the search actually shows, one sentence", "realSource": "actual publication title and year" | null}],
"fixed": {"eyebrow": "...", "cover": "...", "slides": [{"title": "...", "body": "..."}], "cta": "..."}}
Rules for "fixed": keep everything that checked out word for word; correct wrong numbers to what you found and cite the real source on its own line as "Source: <title, year>"; where a claim is unverifiable, rewrite the line to carry the insight without the number and remove its source line. Same slide count.`;
}

// ---------------------------------------------------------------------------
// modifyContent() — targeted "↻ Revise content" instruction (PRD §8).
// ---------------------------------------------------------------------------
export function buildModifyPrompt(opts: {
  eyebrow: string;
  cover: string;
  slides: CoercedSlide[];
  cta: string;
  instruction: string;
  housePrefs?: string;
}): string {
  const { eyebrow, cover, slides, cta, instruction, housePrefs = "" } = opts;
  const current = JSON.stringify({ eyebrow, cover, slides: slides.map((sl, i) => ({ slide: i + 1, title: sl.title, body: sl.body })), cta });
  const prefBlock = housePrefs.trim() ? `\nSTANDING TEAM PREFERENCES, apply proactively:\n${housePrefs.trim()}\n` : "";
  return `Edit this social-deck content for Kognoz. Voice: a senior partner speaking to a CEO. Declarative, behavioral, specific. No em dashes, no "not just", no "unlock", no "leverage", no "journey", no hedging, no URLs anywhere.

CURRENT CONTENT (slides are numbered for reference): ${current}

INSTRUCTION: "${instruction.trim()}"
${prefBlock}
CONTRACT:
- Follow the instruction exactly. If it targets specific parts ("slide 2", "the cover", "the closing"), change only those and copy everything else back word for word.
- If it asks for more slides or a different count, add or remove them (2 to 8 total), written in the same voice. Otherwise keep exactly ${slides.length} slides.
- Keep exactly one word marked with *asterisks* in "cover".
- Field roles are fixed: "title" is a 4-7 word claim; "body" is one idea under 200 characters.
Return ONLY JSON in this exact shape, slides in final order, numbering removed: {"eyebrow": "...", "cover": "...", "slides": [{"title": "...", "body": "..."}], "cta": "..."}`;
}

// ---------------------------------------------------------------------------
// applyDesignNote() — free-text design instruction mapped to allowed keys only.
// ---------------------------------------------------------------------------
export function buildDesignNotePrompt(instruction: string): string {
  return `Map this design instruction for a branded social-slide system onto settings. Instruction: "${instruction.trim()}".
The system has these controls and no others:
- "url": the small website line shown as a design element (string, e.g. "kognozconsulting.com")
- "coverRight": what sits bottom-right on cover slides: "swipe" | "url" | "none"
- "contentRight": bottom-right on inner slides: "page" (page numbers) | "url" | "none"
- "singleRight": bottom-right on single cards (stat, dialogue, split, story, video): "cta" (the closing line) | "url" | "none"
- "petals": whether the soft background circle motif shows: true | false
- "set": the deck's visual family: "editorial" | "numeral" | "dark" | "glass" | "bloom" | "magazine" | "mixed"
Return ONLY a JSON object containing just the keys the instruction actually addresses.`;
}

/**
 * A whole month of the content calendar, in one call.
 *
 * The schedule only — who posts, what about, which day, which format, which pillar. No
 * captions: those stay per-item, both because forty extra calls would burn most of the
 * hourly budget and because you should not pay for copy on posts you are going to cut.
 *
 * Two things this prompt has to get right that a Studio prompt does not:
 *
 *   the people   It writes in the names of real co-founders. lib/founderProfiles.ts holds
 *                what research could actually verify, and DO_NOT_ASSERT holds what it
 *                could not — those lines go into the prompt as hard prohibitions, because
 *                a confident false claim about a real firm is a reputational cost.
 *   the shape    A month is a campaign, not 36 unrelated posts. The existing hand-written
 *                plan builds callbacks (a poll, answered by a stat card five days later),
 *                and that is most of why it reads as deliberate.
 */
export function buildCalendarPlanPrompt(opts: {
  year: number;
  monthName: string;
  /** Weekday days-of-month still free, in order. */
  availableDays: number[];
  /** Topics already scheduled, so a second month does not repeat the first. */
  existingTopics: string[];
  targetCount: number;
}): string {
  const { year, monthName, availableDays, existingTopics, targetCount } = opts;

  const profiles = CHANNEL_IDS.map((id) => {
    const p = FOUNDER_PROFILES[id];
    return `${id} — ${p.publicName}, ${p.role}
Voice: ${p.voice}
Writes credibly about: ${p.evidencedTopics.join("; ")}
Formats that suit this identity: ${p.suitsFormats.join(", ")}`;
  }).join("\n\n");

  const avoid = existingTopics.length
    ? `\nALREADY SCHEDULED — do not repeat these subjects or restate them from another angle:\n${existingTopics
        .slice(0, 60)
        .map((t) => `- ${t}`)
        .join("\n")}\n`
    : "";

  return `Plan ${monthName} ${year} for Kognoz's LinkedIn presence: ${targetCount} posts across three publishing identities.

${BRAND_CORE}

THE THREE IDENTITIES. Each is a real person or a real company page, so write only what that identity can credibly say.

${profiles}

FACTUAL LIMITS, NON-NEGOTIABLE. Research could not verify these, so they must never appear:
${DO_NOT_ASSERT.map((d) => `- ${d}`).join("\n")}

THE MONTH IS A CAMPAIGN, NOT A LIST.
- Build two or three deliberate arcs across the month: a poll early that a later post answers with what people chose; a deck that a follow-up post refers back to the next working day; a month-closing post that looks back at the month.
- Where a post depends on an earlier one, the later post's topic must make the dependency obvious, and its day must come after the post it refers to.
- No two posts may make the same argument. Vary the pillar and the format run to run — never three of the same format in a row.

CADENCE. Post only on the days listed as available: ${availableDays.join(", ")}. Roughly half of them carry two posts. Aim for this split across the month: ${CADENCE.perChannel["Kognoz page"]} from the Kognoz page, ${CADENCE.perChannel.Lokesh} from Lokesh, ${CADENCE.perChannel.Harpreet} from Harpreet.

TOPIC CRAFT. A topic is a compressed editorial description, not a headline and not a slug.
- 40 to 95 characters. Sentence case. No title case, no colons, no questions, no hashtags.
- State a tension or a claim, usually as two clauses: "The survey said empowered, while decisions travelled two levels up".
- Behavioural language: name what people do, never how they feel. No "not just", "unlock", "leverage", "seamless", "journey", "game-changer", "delve", "holistic", "elevate". No em dashes. No exclamation marks.
- Every topic must be specific enough that two different writers would produce recognisably the same post.
${avoid}
Return ONLY valid JSON in exactly this shape, with no commentary before or after:
{"items": [{"day": 1, "channel": "Kognoz page", "format": "Carousel", "pillar": "Behavioral Signal", "topic": "the compressed description"}]}

- "day" is a number from the available list above.
- "channel" is exactly one of: ${CHANNEL_IDS.join(", ")}.
- "pillar" is exactly one of: Behavioral Signal, Consulting POV, Market Intelligence, Human + AI, From the Work.
- "format" is exactly one of: Carousel, Square, Idea Deck, Article Cover, Stat Card, Says vs Does, Dialogue, Montage, Story, Video, Founder Video, Text post, Poll.

Return exactly ${targetCount} items, ordered by day.`;
}
