# Social Studio

Next.js port of the Kognoz Social Studio, now producing for **two brands**: Kognoz (the
consulting firm) and **Konverz AI** (its talent platform). `kognoz-social-studio-v3.jsx`
and the two-brand `social-studio-v4-kognoz-konverz.jsx` are the reference
implementations; content generation, the slide renderer, export pipeline, and the
calendar all work end-to-end against real Claude calls — through a secure server proxy,
never a client-side key.

## Two brands

A toggle in the Studio sidebar and the calendar header switches everything: palette,
fonts, logo, background motif, pillars, publishing channels, design sets, the ground
truth injected into every prompt, the voice corpus, and which saved calendar and house
style load.

- **`lib/brands.ts`** is the registry and the place to read first. Its header explains
  why the brand is a value threaded through React context rather than the mutable
  module globals the v4 artifact uses — module state is shared across requests on the
  server and frozen at hydration on the client, so mutating it is a correctness bug
  here even though it is fine in a single-file browser artifact.
- Components read it once and shadow the token imports:

  ```tsx
  const brand = useBrand();
  const { C, GRAD, GRAD_DARK, font, displayFont } = brand;
  ```

  which is what lets ~190KB of existing renderer code keep saying `C.blue` untouched.
  Pure modules (`promptBuilders`, `brandCore`, `humanizePass`, `slopLint`) take an
  explicit `brand` argument and default to Kognoz, so nothing untouched changed.
- **Stored data is per brand and nothing moved.** Keys are `` `${brand.id}-${name}` ``,
  and the existing Kognoz keys were already spelled `kognoz-calendar`, `kognoz-design`,
  `kognoz-house-prefs`, `kognoz-style-memory`, `kognoz-voice-samples`. Konverz simply
  reads keys that do not exist yet. No migration.

### Where a month's topics come from

`/calendar` has a **Market scan** above the Generate button. It is a grounded
search — the only one in the app besides generation and fact-checking — that returns
8 to 18 real problems in that brand's market, each with who feels it, the evidence,
and the publication it was found in. You read and edit that list; the month planner
then writes every topic from what survives and reports which problem each came from.

Without it, the planner writes from what the model already believes about the market,
which reads plausible and cannot be checked. That path still works and is never
blocked — the first press of Generate warns, the second proceeds, and the result note
says which of the two months you got.

Three things worth knowing before changing any of it:

- **A scanned figure is not a licence to print that figure.** It reaches the planner as
  subject matter and the calendar card as context. The sourcing rules in
  `buildGeneratePrompt` and the Verify facts button still decide what appears in copy.
- **The scan prompt refuses two things on purpose**: themes (anything that could be a
  conference track title) and product descriptions. A model asked to research the market
  for a talent platform drifts into listing what such a platform would fix, and every
  topic planned off that becomes a feature post.
- **Scans go stale.** 45 days, then the panel says so. Market facts move; founder facts
  do not, which is why `lib/founderProfiles.ts` is still written down by hand and this
  is not.

### The humanize pass, per brand

`lib/humanizePass.ts` runs on deck generation, the article writer, and calendar
captions, and it now knows which brand it is editing for. Two things about it are worth
knowing before changing anything:

1. **The ban list is shared; the exemptions are not.** Konverz's canon is built on the
   Hire/Nurture/Coach/Learn *journeys*, there is a format called Journey Map, and the
   deck tagline is "*Elevating* Talent Decisions" — and "journey" and "elevate" are both
   on the shared banned-phrase list. `Brand.allowedPhrases` subtracts them for Konverz
   only. It can only ever subtract, and `bannedFor()` in `lib/slopLint.ts` feeds both the
   prompt and the linter, so the rule the model is given and the rule it is measured
   against cannot drift.

2. **It gets two rounds, not one.** After the rewrite the draft is re-linted; if it
   still scores under 85 or leaves a high-severity finding, one more pass runs against
   what is left. Two rounds is a hard cap. The draft is never lost, a round that fails
   mid-loop keeps what the earlier round produced, and the *best* round wins rather than
   the last. One subtlety: round one always beats the draft whatever the score says,
   because the linter cannot see a concrete scene replacing an abstraction, and that is
   most of what this pass is for.

3. **Revise runs it too.** It used to be the one button that could undo the humanising.

4. **Konverz starts with an empty voice corpus, on purpose.** The 36-item Konverz month
   plan in `lib/konverzTemplate.ts` looks seedable and is not: its copy was written by a
   model. `lib/voiceSamples.ts` exists precisely because this app once learned its voice
   from its own output, so `samplesFromTemplate()` is gated to the Kognoz plan and the
   "Import from the editorial plan" button is hidden under Konverz. Until somebody pastes
   real published Konverz posts into Voice samples, the edit pass runs with the ban list
   and the rhythm rules but nothing human to imitate — and the Studio says so in as many
   words rather than leaving it to be discovered.

### Fifteen formats

The v4 reference added four the v3 port never had: **Feature Card**, **Numbers Wall**,
**Customer Quote** and **Journey Map**. Both brands get all fifteen, in the v4's order.
Two are worth a note:

- Customer Quote's cover *is* the quotation, so it takes a 260-character budget and
  `ensureEm` is switched off for it — marking a word inside somebody's published words
  is a misquote, not a design flourish.
- Numbers Wall reuses Stat Card's title hygiene, because it is the same problem four
  times: a tile whose title must be the figure alone, and a model that keeps writing the
  whole sentence into it.

## What's real and working

- **`/`  (Studio)** — pick format/pillar, type a topic, Generate. Full slide preview
  (`components/Slide.tsx`, all 13 formats × 7 design sets), inline editing, Revise/
  Regenerate, Verify facts, Design panel (sets/accents/petals/design-note), House
  style, Article writer, and export (Deck PDF, per-slide PNG, review strip, montage
  panorama, download all).
- **`/calendar`** — the real 36-item Month-1 plan, status tap-cycle, Create→ (opens
  Studio pre-filled and auto-generating) and Write→ (inline caption generation +
  revise) for Text post/Poll items.
- **`/api/claude`** — the only thing that ever calls Anthropic. Model allowlist,
  search-tool gating (only `generate`/`verify` tasks may use it), per-user rate
  limiting, spend logging, sanitized errors. `ANTHROPIC_API_KEY` lives in Vercel's
  server environment only — it is never sent to, or present in, browser code.
- **`/api/store`** — Supabase-backed shared storage (calendar, house-prefs,
  style-memory, design), replacing the artifact's `window.storage`.
- **Auth** — username/password, `users` table is the allowlist, no OAuth/email
  service dependency.

## Ported verbatim from the reference jsx

- `lib/coerce.ts` — the full `coerceContent` quality firewall, plus Stat Card
  hygiene and Idea Deck kicker normalization (PRD §7 points 6-7).
- `lib/brandCore.ts` — `BRAND_CORE`, all 5 practice lanes, the lane router.
- `lib/promptBuilders.ts` — every prompt sent to Claude, per task/format, word for
  word: `generate`, caption writing, the article writer, Verify facts, Revise
  content, and the design-note mapper.
- `lib/calendarTemplate.ts` — the real 36-item plan.
- `lib/pdfBuilder.ts` — the hand-assembled PDF builder.
- `lib/exportPipeline.ts` — the DOM→SVG→canvas export core (blob URL with
  base64-data-URL fallback, XML parse-error surfacing, taint checks, retries).
- `components/Slide.tsx` — the ~600-line slide renderer, every format/variant.
- `public/brand/*.png` — the real Kognoz logo files, extracted from the jsx's
  embedded base64 (confirms the "Maximising" open item from the PRD directly).

## One deliberate addition beyond the reference

- **`lib/exportFonts.ts`** — PRD §3.3 names a known defect in the artifact version
  (exports fall back to Georgia because fonts aren't embedded) and specifies the
  fix: fetch Fraunces/Open Sans once, convert to base64, embed as `@font-face` in
  the export SVG. Built to that spec, and now cached per stylesheet URL rather than
  once per session, so a Konverz export embeds Poppins and a Kognoz export still
  embeds Fraunces + Open Sans. **Not exercised in this sandbox** (no network path to
  fonts.googleapis.com here) — needs a real-browser smoke test once deployed: export
  one deck per brand and inspect a PNG for true Fraunces and true Poppins rather than
  a fallback.

## What's NOT ported (scoped out, not guessed at)

- **Video recording** (`recordVideo` / `MediaRecorder` / `wrapCanvasText`) — the
  Kinetic Video format's preview and poster-PNG export work; the "Record video
  (.webm)" capture button does not. Flagged rather than rushed.
- **`/calendar`'s own visual layout** — functional (real data, real actions) but its
  UI is my own construction, not a port, since I didn't have the original App's
  `view === "calendar"` JSX branch in view when I built it.

## Open items

- **Poppins is an assumption.** `Konverz_Website_Inputs.md` §9 lists it as observed
  across the deck and the site, not confirmed as the official brand font. It is one pair
  of constants in `lib/tokens.ts` and one family in `app/layout.tsx`.
- **Konverz has no separate mark asset.** The brand kit describes the magenta
  speech-bubble "o" used solo as a watermark, but only the wordmark is embedded in the
  v4 file, so `KONVERZ.logos.mark` points at the colour wordmark. `<Bubble>` in
  `components/Slide.tsx` is wired and unused, waiting for the real file.
- **Revise is still outside the humanize pass** for both brands. A generated deck is
  line-edited; text produced by a later "Revise content" is not, so heavy revising can
  walk output back toward machine prose.

## Tests

`npm test` — 29 files, 647 tests. Several are tied directly to named PRD §16 cases:
the `structureBody` failure string, the `"1,700+ GCCs. One critical gap"` stat-title
split, the mobility/AI-skills → talent lane-routing case, and the PDF builder's
xref-offset structural check.

The two-brand work added guards for the failures that are invisible without one:

- `lib/brands.test.ts` — every brand fills every field the renderers and prompts read;
  `allowedPhrases` can only name phrases the shared list actually bans; the Kognoz canon
  still carries neither "Middle East" nor "Immersion Index" (the v4 file does, and
  `DO_NOT_ASSERT` forbids both); `brandKey` reproduces the existing Kognoz storage keys
  byte for byte.
- `lib/promptBuilders.test.ts` — a Konverz prompt contains no stray "Kognoz" outside the
  parent line, and an unthreaded call still produces exactly the Kognoz prompt.
- `lib/slopLint.test.ts` — "journey" is a finding for Kognoz and is not one for Konverz,
  while every structural rule fires identically for both.
- `lib/storeKeys.test.ts` — the allowlist in `lib/supabase.ts`, the CHECK constraint in the
  newest migration, and the seed rows in `schema.sql` must list the same keys, and every
  brand must have all six of its own. Three hand-maintained copies of one list, carrying a
  comment warning about drift that the second brand then walked straight past: every
  Konverz read came back 400 and the calendar blamed the network. A comment cannot fail a
  build.
- `lib/marketScan.test.ts` — the scan prompt refuses themes and product descriptions, would
  rather return a short sourced list than a long assumed one, and searches each brand's own
  market. Plus the number-to-problem resolution, which must drop an out-of-range index
  rather than attach the wrong problem to a post.
- `lib/humanizePass.test.ts` — the re-edit loop: the draft survives a failure at any round,
  the best round wins rather than the last, and an already-clean draft still keeps its edit.
- `lib/slideStyles.test.ts` — the gradient word. `background` is a shorthand that resets
  `background-clip`, so writing it after the clip renders the marked word as a solid
  rectangle with invisible text. Nothing throws and no other test notices; this one was
  written after the defect shipped into the branch and was caught by rendering a slide.

## Deploying this branch

`supabase/migrations/2026-09-16_konverz_brand_keys.sql` **must be run against the live
database** before Konverz can save anything. Paste it into the Supabase SQL editor. It is
idempotent and touches no data — it widens the `store.key` CHECK constraint and seeds
empty rows. Without it the allowlist gets past the route and the database rejects the
write.

## Setup

See the deploy walkthrough shared alongside this file — GitHub → Supabase → Vercel,
no local run needed. Quick reference if you do run locally:

1. `npm install`
2. Create a Supabase project, run `supabase/schema.sql` against it
3. Copy `.env.example` to `.env.local`, fill in Anthropic key, Supabase URL/service
   key, `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
4. Add each team member. Two routes, both supported — this table is the allowlist and
   there is no public signup:

   - **Terminal:** `npm run add-user "name@kognozconsulting.com" "Their Name"`. Omit the
     password and a strong one is generated and shown once, so nothing is typed anywhere.
     Pass a third argument to set a specific one, though it then lands in your shell
     history.
   - **No terminal:** paste `supabase/add-user.sql` into the Supabase SQL editor and edit
     two values. Postgres hashes the password itself. The trade-off is that the password
     is typed in plaintext and stays in the editor's query history until you clear it.

   The email domain does not matter on either route. The company-domain check applies only
   to Azure AD sign-ins, so this is also how you give access to someone outside the
   Microsoft tenant — they use the password form on `/login` rather than the Microsoft
   button.
5. `npm run dev`

**No keys or secrets are committed anywhere in this repo** — `.env.local` is
git-ignored, `.env.example` has empty values, and the only place secrets exist is
Vercel's environment variable settings (server-side only) and Supabase's own
dashboard.
