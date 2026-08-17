# PRD — Kognoz Social Studio (Standalone Web App)

**Version:** 1.0 · **Owner:** LN (Kognoz Consulting) · **Status:** Ready for build
**Reference implementation:** `kognoz-social-studio-v3.jsx` (working single-file React app, ~all features below proven in it; port, don't reinvent)
**Target:** Next.js on Vercel, used daily by the Kognoz marketing/founder team

---

## 1. Overview

The Kognoz Social Studio is an AI-powered content production system for the firm's LinkedIn presence. It generates, designs, fact-checks, iterates, and exports publication-ready social assets (carousels, idea decks, stat cards, videos, articles and more) in the Kognoz brand system, driven by a built-in 30-day editorial calendar with per-founder voices.

**Why standalone:** the current version runs inside a Claude artifact (single user, no shared state, no true fonts in exports, API access only via the artifact sandbox). The team needs a hosted multi-user tool with shared calendar state, secure API access, and pixel-perfect exports.

**Product principles (learned the hard way in prototyping — treat as law):**
1. **Code enforces, prompts suggest.** Every brand/content rule that matters (line structure, banned punctuation, source discipline, slide counts, gradient word) must be enforced in deterministic post-processing, never only in the prompt.
2. **Uniform within a deck, distinct between decks.** One design family per deck; variety lives in the set/accent choice, not per-slide scatter.
3. **No unverified facts leave the building.** Statistics generate search-grounded; a one-click verification pass audits any deck before publishing.
4. **Every failure is visible.** No silent no-ops. Every async action surfaces the real error name + message in the UI.
5. **Recommended but changeable.** The calendar recommends format/pillar/style/set per item; every field is editable inline with one-tap restore.

---

## 2. Users & Roles

| Role | Needs |
|---|---|
| Founders (Lokesh, Harpreet) | Review/approve assets in their voice; occasionally generate directly; record videos from scripts |
| Marketing operator (primary daily user) | Produce the calendar: generate → iterate → verify → export → post; manage statuses |
| Admin (LN) | Manage access, house style, API spend visibility |

Auth v1: email allowlist (NextAuth, magic link or Google) — 5–10 seats. No public signup. All users share one workspace.

---

## 3. Architecture (Vercel)

```
Next.js 14 (App Router)
├─ / (Studio)  /calendar  — client components (port of v3 UI)
├─ /api/claude            — serverless proxy to Anthropic API
├─ /api/store             — shared storage (Vercel KV or Supabase)
└─ /public/brand/*        — logo pack (also inlined as base64 for exports)
```

### 3.1 API proxy (`/api/claude`) — the critical change
The browser must never hold the Anthropic key.
- `POST /api/claude` body: `{ task: "generate"|"revise"|"caption"|"article"|"verify"|"designNote", prompt: string, model?: string, maxTokens?: number, useSearch?: boolean }`
- Server: `ANTHROPIC_API_KEY` in Vercel env; **model allowlist**: `claude-sonnet-4-6` (creation), `claude-haiku-4-5-20251001` (fast transforms). Reject others.
- `useSearch: true` adds `tools: [{ type: "web_search_20250305", name: "web_search" }]` and raises `max_tokens` to 3000. Only permitted for tasks `generate` (grounded formats) and `verify`.
- Response: pass through `content` blocks; client extracts/joins `type === "text"` blocks (existing logic).
- Rate limit: per-user, e.g. 60 calls/hour; return 429 with friendly message.
- Log task, model, tokens per call (spend visibility for admin).

### 3.2 Storage (`/api/store`)
Replace artifact `window.storage` with shared server storage. Same key semantics as v3:
- `kognoz-calendar` — the plan `{ month, tmplV, items[], history[] }` — **shared, team-wide** (the whole point of going standalone)
- `kognoz-house-prefs` — house style rules (shared)
- `kognoz-style-memory` — approved few-shot examples, max 6 per format (shared)
- `kognoz-design` — design settings (per-user preferable; shared acceptable v1)
API: `GET/PUT /api/store?key=…` (JSON values, last-write-wins). v1 conflict handling: refetch calendar on tab focus; optimistic UI.
Recommended backing: Vercel KV (simplest) or Supabase Postgres (if audit history wanted later).

### 3.3 Fonts — fixes a known defect
Load **Fraunces** (display) + **Open Sans** (body) via Google Fonts for the UI. For exports (see §12), fetch both fonts once, convert to base64, and embed as `@font-face` inside each export SVG's `<style>` so rasterized PNGs/PDF pages render true Fraunces (the artifact version fell back to Georgia — unacceptable for production).

### 3.4 Brand assets
Logo pack (from `kognoz-brand-assets/`): full color + white (with tagline), wordmarks, mark. Ship in `/public/brand/` AND as base64 constants for the export pipeline (external URLs taint canvases). Logo aspect ratio 3.6:1; render via a `Logo` component with explicit width = height × 3.6, `objectFit: contain`, `flexShrink: 0`. **Open item:** logo tagline reads "Maximising" (British); site copy is American — resolve before launch or keep logo untouched (current decision: untouched).

---

## 4. Content Formats (13)

All slides 1080-basis, exported at full size. Uniform chrome on every card: fixed footer (`Foot`: left/right 96, bottom 84, logo height 64), content padding `96px 96px 196px`, site-language `Eyebrow` (letterspaced uppercase, optional slide number, **no accent bars**).

| Format | Dimensions | Structure / notes |
|---|---|---|
| Carousel | 1080×1350, deck | Cover + 2–8 content slides + end slide. Primary format |
| Square | 1080×1080, deck | Same machinery, 1:1 |
| Idea Deck ("stash") | 1080×1350, deck | Deepstash-style atomic cards. **Three styles:** Signals (Signal NN + one Ask→Reveal pair mid-deck), Book review (Idea NN + Ask/Reveal + dark closing card kicker exactly "The Kognoz read"; cover = book's core claim; cta = title + author), Story (kickers Scene 01–03 / The turn / The read / The lesson, kept as written). Cover = stacked-cards visual "N ideas · swipe". Ask card = dark gradient + "The answer is on the next card"; Reveal = teal border |
| Article Cover | 1920×1080 | 3 variants incl. glass. Pairs with the Article Writer (§10) |
| Stat Card | 1080×1350 | Title = **the figure alone (≤10 chars)**; body = separate lines: claim / optional capability line / `Source:` caption. 2 designs (gradient number / dark glass) |
| Says vs Does | 1080×1350 | Split: mist-italic "says" vs dark "does" |
| Dialogue | 1080×1350 | Chat bubbles; light or dark-glass variant; "Kognoz" speaker right-aligned |
| Montage | 3240×1350 | 3-frame panorama; exports as 3 sliced frames AND single panorama; dashed cut guides in preview |
| Story | 1080×1920 | Vertical; auto-switches to full-bleed photo + scrim + glass panel when a photo is set |
| Video · Kinetic | 1080×1350 | CSS-animated preview; canvas MediaRecorder → ~8s .webm; honors per-slide text scale |
| Founder Video · Script | — | Spoken script (Hook 0–8s / Setup / Insight / Close) + caption card |
| Text post / Poll | — | Calendar-only: full post 90–150 words / POLL spec, written by the caption engine |

---

## 5. Design System

**Palette:** blue `#005184`, green `#88B787`, cyan `#43AFCD`, teal `#55B09D`, ink `#212121`, inkSoft `#4A5560`, inkMute `#6B7680`, off `#F4F7F9`, mist `#EAF1F4`, line `#DCE6EB`, white; gradient `120deg #009BDD → #75A02F`; dark gradient from `#063D5E`.
**Type:** Fraunces 600 for display (H1/titles/numerals, tight letterspacing), Open Sans for body/UI.
**Motif:** the Petal (soft circle cluster SVG) with a 9s "breathe" scale keyframe in preview (static in exports). Toggleable (`design.petals`).
**Gradient word:** exactly one `*word*` per cover, rendered with the brand gradient (`renderEm`). Enforced in code (§7).
**Glass tokens:** `GLASS_DARKBG` / `GLASS_LIGHTBG` (translucent fill + 1px translucent border + blur 16–18px + deep shadow). Designed to degrade gracefully where blur doesn't rasterize.
**Banned as AI-tells (design):** accent bars, pills, random per-slide variant scatter.

### 5.1 Design Sets — one family per deck (uniformity is a tested invariant)
| Set | Cover | Content layout (every slide) | Stat/Dialogue register |
|---|---|---|---|
| Editorial · light | light petal | classic light | classic |
| Numeral · light | light petal | ghost-numeral | classic |
| Boardroom · dark | dark | dark gradient | glass |
| Glass | glass panel on dark | frosted tile | glass |
| Bloom · minimal | motif-forward bloom hero | framework callout (mist card, 6px left accent border) | classic |
| Magazine · photo | photo cover (upload slot) | full-bleed photo + glass caption | classic |
| Mixed · max variety | rotates | rotates all 8 content variants | seed-based |

Additional content variants that exist and are used by sets/Mixed: pull-quote (giant " glyph, italic Fraunces), spectrum top-rule (colored top border + accent title — the v8 pill replacement), photo layout (explicit).

**Controls:** set chips + accent-tone chips (Auto/pillar, Blue, Teal, Cyan, Green) in a Design panel; **🎲 Next look** cycles 6 sets × 5 accents = 30 uniform looks (button label names the current look); free-text design note mapped by the fast model to ONLY `{url, coverRight, contentRight, singleRight, petals, set}` (invalid keys discarded); URL renders only as footer chrome, never in content (`stripUrl` on all fields).

### 5.2 Photo system
- **Explicit, never variant-luck:** per-slide 📷 toggle (`imgOn` keyed by deck index) overrides that slide to its photo layout; shuffle can never add/remove photos. Hidden for Idea Deck.
- Stable image keys: `s{idx-1}` per content slide, `cover`, `story`, `article`.
- **🔗 Image URL import:** paste URL → fetch → blob → FileReader dataURL (inlined to avoid canvas taint). CORS failures produce a helpful error; Unsplash (`images.unsplash.com`) imports cleanly. Upload-by-click is always available on any slot.
- All images cleared on fresh generation.

### 5.3 Layout invariants (regression-tested)
- Preview box `flexShrink: 0`; preview column scrolls (`overflowY/X auto`) — **never** lets flexbox crush the artwork (the "cut logo" bug class).
- All control rows `flexShrink: 0` + wrap.
- Per-slide text size control: A−/A+ 60–150% in 8% steps, scales content only, honored in exports and video; resets on generation.

---

## 6. Content Engine — Grounding & Voice

### 6.1 BRAND_CORE (injected into every fresh generation & caption)
Positioning "Your people are your strategy"; method "We measure behavior, not opinion"; Augmented Intelligence™ ("AI recommends; a human always decides"); proof: 650,000+ jobs architected, 50,000+ leadership assessments, 200+ enterprises, 12 countries; Konverz AI = the firm's platform. (Full text in reference implementation.)

### 6.2 Practice Lanes — mutual exclusivity (from the v8 site structure)
Five lanes, each with in-lane concepts AND explicit off-limits lists naming the owning practice:
- **Culture** (Immersion Index™ + Purpose/Ownership/Mastery/Trust/Wellbeing, behavior vs survey, speak-up, manager transmission) — off-limits: decision rights/Decision Architecture (Org), succession (Talent), Work Spectrum (AI Work), founder dynamics (Family)
- **Talent & Leadership** (succession depth, readiness, hidden performers, assessments, nationalization, mobility)
- **Organization Design** (Decision Architecture, decision rights, operating model, spans/layers, job architecture)
- **Human + AI Work Design** (Work Spectrum, trust thresholds, task decomposition, HR reinvention, adoption as behavior change)
- **Family Business** (lived power structure vs org chart, succession as transfer of real decisions, generational alignment)

**Detector** (keyword routing on the topic, priority order matters): family → org → talent → aiwork → culture → general fallback ("pick ONE lens"). Unit tests included (§16) — e.g. "internal mobility … AI skills" must route **talent**, not aiwork.
**Spanning rule:** primary lane only; a second practice gets at most one closing sentence naming it as adjacent.

### 6.3 Voices
- **Kognoz page** — institutional we/our, evidence-led.
- **Lokesh** — behavioral science, AI and technology; the intersection voice (what people do / what data shows / what technology makes possible).
- **Harpreet** — technology & HR transformation; AI-led HR (agentic workflows with human gates, HCM at scale); implementation-tested "what actually happened when we built it".

### 6.4 Language regime (prompt + code)
Senior-partner-to-CEO. Declarative, behavioral, specific.
BANNED: "not just", "unlock", "leverage", "journey", "delve", "navigate", "game-changer", "elevate", "robust", "holistic", "seamless", "it's about", "the key is", "here's the thing", "imagine", em/en dashes, colon headlines, rhetorical-question hooks, exclamation marks, emojis, hashtags, hedging, competitor mentions.
CRAFT: cover ≤8 words; titles 4–7 word claims; one specific detail per slide; no repeats; sharpest point last; model self-audit instruction.
LINE STRUCTURE (all formats): distinct statements separated by real `\n` — claim / capability line / `Source: <title, year>` each on its own line.

### 6.5 Model routing
- Fresh generation, fresh captions, articles → `claude-sonnet-4-6`
- Revisions, caption revisions, design-note mapping → `claude-haiku-4-5-20251001` (fast)
- Grounded generation & verification → sonnet + web_search, max_tokens 3000

---

## 7. Deterministic Post-Processing (REQUIRED — this is the quality firewall)

Applied in `coerceContent` on every generation/revision; the model has no vote:

1. **Robust JSON extraction:** first `{` to last `}`, one corrective retry on parse failure. Same tolerance for plain-text calls (`callClaudeText`) with visible errors.
2. **`structureBody`** on every slide body: em/en dash clause-chains → line breaks; force `\n` before any inline `Source:`; force `\n` before a sentence starting `Kognoz|Konverz`; capitalize each resulting line; drop empties.
3. **`scrubInline`** on every single-line field (titles, cover, cta, eyebrow): em/en dashes → ", ".
4. **`ensureEm`**: if cover lacks `*word*`, mark the longest meaningful word (the gradient word can't be missing).
5. **`stripUrl`** everywhere (URL is chrome only); **`stripWrapQuotes`** on cover; **clamp** at word boundaries (cover 95, title 64, body 230, cta 110); cap 8 slides; **no count lock** (revisions may change count 2–8).
6. **Stat Card hygiene:** if title >12 chars, split at first period — figure stays as title, remainder prepends to body; then one-sentence-per-line split; strip figure-echo when body opens with "<figure> of ".
7. **Idea Deck kicker normalization** by style: signals → `Signal NN`; book → `Idea NN` + preserved `Ask`/`Reveal`/`The Kognoz read`; story → kickers kept as written.
8. **Eyebrow locked to the selected pillar** (ignore model drift).

Unit-test set §16 includes the two real-world failure strings from prototyping; both must pass forever.

---

## 8. Iteration Engine

- **↻ Revise content** (instruction box): sends **numbered slides** + CONTRACT — targeted edits ("slide 2", "the cover") change only the target and copy all else word-for-word; count changes allowed 2–8; runs on the fast model. All coercion (§7) reapplies.
- **⟳ Regenerate afresh:** new angle + new seed, ignores style memory.
- **Manual controls (zero-latency):** every field editable in sidebar; + Add slide / Remove per slide.
- **House style:** opt-in "+ Rule" list injected as standing preferences (never auto-appended — prototype's auto-append polluted the box).
- **Style memory:** each downloaded/exported final is captured as an approved example (max 6, format-matched few-shot); skipped on "afresh".
- Busy-guards on all entry points; buttons must call handlers as `() => fn()` (the event-as-argument regression is a named test).

---

## 9. Fact Verification (credibility firewall)

- **Grounded generation:** Stat Card, Montage, and any Market Intelligence-pillar generation runs with web_search and the GROUNDING contract: state only numbers visible in results; cite the source actually found ("Source: <publication, year>"); if unverifiable, carry the insight without a number and with no source line. All other formats: **no named external sources from memory, ever**; firm proof numbers may be attributed as Kognoz's own.
- **🔍 Verify facts (any deck):** sends current content to a web-searching checker → per-claim verdict cards: ✓ verified (green) / ✗ wrong (red, with what search found + real source) / ? unverifiable (amber) → **Apply corrections** rewrites the deck (right numbers + real sources on caption lines; unverifiable figures removed, insight preserved; same slide count). Nothing changes without the click. All-green shows "Publish with confidence."
- **House protocol:** any asset containing a number → Verify → green → publish.

---

## 10. Article Writer

Attached to the Article Cover format. One click writes the full piece (sonnet, max_tokens 2600):
- 900–1,200 words, markdown (# title, 4–6 ## sections, 2–4-sentence paragraphs, ≤1 list)
- First two sentences = the pre-click hook; opening section answers the core question within 150 words **phrased as a liftable definition (GEO/AEO)**
- One anonymized example; a "what to do this quarter" section; close inviting conversation + kognozconsulting.com
- No invented statistics; no named external sources from memory
- Editable textarea + word count; revise line (fast model); 📋 Copy (markdown pastes into LinkedIn's editor) + ⬇ .md download; clears on fresh generation.

---

## 11. Calendar (the operating surface)

- **36 items, Month 1**, template v2 (full data in reference implementation): weeks Arrival / Depth / Interaction / Authority / Month-end; channels Kognoz page (14) / Lokesh (12) / Harpreet (10); founder videos 2+2 (batch-record one session); poll→stat loop (#14→#19); two GEO definition articles (#07 Immersion Index, #21 Work Spectrum); Idea Deck lane #16 (Book: The Culture Code) → #22 (Signals game + next-day reveal #23) → #33 (Story: founder-family alignment); design sets pre-assigned (#01 editorial, #11 dark, #15 magazine, #28 glass, #32 bloom).
- **Per item:** number, day, channel chip (color-coded), **format select**, editable topic, **pillar select**, **style select** (Idea Deck), **set select** (Carousel/Square), status chip Planned→Drafted→Posted (tap-cycle), pre-written caption ("Post ▾" expand, Copy text, ↻ Revise with instruction via fast model, visible per-item write errors).
- **Recommended but changeable:** template values are the recommendation; any drift shows **↺ recommended** (one-tap restore of fmt/pillar/style/set).
- **Create →** loads Studio with the item's format+style+set, auto-generates, sets Drafted. **Write →** for Text/Poll formats (length specs per type).
- **Roll to Month N+1:** archives `{month, posted/of}` history, resets statuses.
- **Migration:** `tmplV` versioning — template changes rebuild items while preserving statuses by `n`.
- First-hour comment protocol + posting cadence live in the strategy docs (`Kognoz_Social_Media_Design_Center.md`, `Kognoz_30_Day_Launch_Calendar.md`) — link both from an in-app "Playbook" menu item.

---

## 12. Export Pipeline (hardened; port exactly, then add fonts)

**Slide → image core:** serialize slide DOM → XHTML sanitize (strip inputs & style tags, self-close `img`/`br`, `&nbsp;`→`&#160;`) → wrap in SVG `foreignObject` → **DOMParser XML validation surfacing parsererror text** → load via **Blob URL, base64 data-URL fallback** (CSP-blocked-blob case) → `img.decode()` + settle delay → **warm-up draw, fresh canvas, taint check** → `toBlob` → DOM-attached anchor download → 3 retries with backoff. Every failure shows the real error. **New for standalone:** embed base64 `@font-face` (Fraunces + Open Sans) in the SVG so exports use true fonts.

**Per format:**
- Decks → **⬇ Deck PDF · LinkedIn-ready** (primary): each slide → JPEG (q 0.92) → hand-assembled PDF, one image per page (catalog/pages/page+contents+XObject per slide, DCTDecode, byte-accurate xref — builder is structurally unit-tested §16); progress label "Building PDF · slide n/N". Plus: This slide PNG · 🧵 Review strip (half-scale single image — mobile canvas-memory safe) · Download all (900ms gaps; browser multi-download permission noted in caption).
- Montage → 3 sliced frames (800ms gaps) + 🖼 Panorama single PNG.
- Singles (Stat/Says/Dialogue/Story/Article) → single PNG.
- Video → MediaRecorder .webm (~8s). *(Open item: LinkedIn prefers MP4 — evaluate `MediaRecorder` MP4 support or a server-side transcode later.)*

---

## 13. API Contract Summary

| Task | Model | Search | Notes |
|---|---|---|---|
| generate (deck/single) | sonnet | if Stat/Montage/Market-Intel | BRAND_CORE + laneContext(topic) + format spec + LINE_RULE + grounding/sources block |
| revise | haiku | no | numbered slides + targeted-edit contract |
| caption (fresh) | sonnet | no | voice block (§6.3) + BRAND_CORE + lane |
| caption (revise) | haiku | no | current draft + instruction |
| article (fresh/revise) | sonnet/haiku | no | §10 spec |
| designNote | haiku | no | maps to allowed design keys only |
| verify | sonnet | yes | per-claim verdicts + fixed content JSON |

All calls: tolerant extraction, one retry, visible errors. Never expose raw provider errors with keys/headers.

---

## 14. Non-Functional

- **Security:** key server-side only; auth required on all routes; store API rejects unknown keys; no PII beyond team emails.
- **Latency targets:** revise <6s (haiku), generate <15s, grounded generate/verify <45s (label the wait honestly).
- **Cost guardrails:** per-user rate limits; admin page shows daily token spend by task.
- **Browser support:** Chrome/Edge/Safari desktop + iOS Safari (export pipeline's WebKit hardening exists for this).
- **Privacy:** client anonymization is editorial policy (no client names in generated content — enforced by prompt + review).

---

## 15. Phased Rollout

1. **P0 (week 1):** Next.js scaffold; port v3 UI 1:1; `/api/claude` proxy; localStorage; auth; deploy preview.
2. **P1 (week 2):** shared storage (calendar/house/style-memory); font-embedded exports; Deck PDF verified on iOS + desktop; admin spend page.
3. **P2:** polish — multi-user niceties (who edited last), MP4 evaluation, Playbook page, optional per-user design prefs.
4. **Later (explicitly out of scope now):** direct LinkedIn API publishing; analytics ingestion; multi-brand support.

---

## 16. QA & Acceptance (port the prototype's test harness — it caught 3 shipped-class bugs)

**Runtime render matrix (SSR smoke):** render `<Slide>` for every kind × every design set × 2+ seeds (108-case matrix) + full `<App>`; any throw fails CI. Catches TDZ/undefined-var classes.
**Uniformity invariant:** within each non-Mixed set, 5 slides × 3 seeds must produce identical layout fingerprints.
**Unit tests (must-pass, from real failures):**
- structureBody on: `"Fewer than 1 in 3 fill critical roles through internal mobility. Konverz AI's Talent Intelligence Layer surfaces hidden capability before roles go external. Source: NASSCOM GCC Landscape Report, 2024"` → exactly 3 lines, Source last.
- Dash/echo case: title `"9 in 10"`, body with em-dash + figure-echo → no dashes, no echo, ≥3 lines, Source captioned.
- Stat title `"1,700+ GCCs. One critical gap"` → title `"1,700+ GCCs"` (figure), remainder into body.
- Lane router: the 10-topic table (incl. mobility/AI-skills → talent).
- PDF builder: header, startxref → xref, every offset resolves to `N 0 obj`, page count, JPEG bytes verbatim.
- ensureEm, clamp word-boundary, stripUrl, event-safe `onClick={() => generate()}`.
**Acceptance checklist (manual):** generate in every format; revise "make it 7 slides" and "change slide 2's title…"; 🎲 through 30 looks; 📷 + 🔗 Unsplash import; Verify facts on a stat deck → Apply corrections; Deck PDF opens paginated on iPhone + desktop with true Fraunces; calendar Create→/Write→ honor edited fields; ↺ recommended restores; statuses persist across two users.

---

## 17. Risks & Open Items

| Item | Note |
|---|---|
| Font embedding size | Two embedded fonts per export SVG add ~200–400KB per render; cache the base64 once per session |
| CORS on image import | Unavoidable for arbitrary URLs; UX already explains; optional later: server-side image fetch proxy |
| Grounded-generation latency/cost | Highest-cost calls; keep restricted to data-led formats + explicit Verify |
| MediaRecorder output | .webm accepted by LinkedIn but MP4 preferred; evaluate in P2 |
| Tagline "Maximising" vs site "Maximizing" | Brand decision pending; logo currently used untouched |
| Backdrop blur in exports | Some rasterizers flatten blur; glass designed to hold via border/shadow/translucency |
| Says-vs-Does right panel | One body site may bypass line-aware rendering; verify during port |

---

## Appendix A — Storage Keys
`kognoz-calendar` · `kognoz-house-prefs` · `kognoz-style-memory` · `kognoz-design`

## Appendix B — Companion Documents
- `kognoz-social-studio-v3.jsx` — reference implementation (source of truth for all prompts, specs, template data, and enforcement regexes)
- `Kognoz_30_Day_Launch_Calendar.md` — Month-1 publication plan + production key + voice architecture
- `Kognoz_Social_Media_Design_Center.md` — strategy playbook (pillars, cadence, GEO/AEO)
- `kognoz-brand-assets/` — logo pack
