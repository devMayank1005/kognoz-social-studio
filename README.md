# Kognoz Social Studio

Next.js port of the Kognoz Social Studio. `kognoz-social-studio-v3.jsx` (the reference
implementation) has been fully ported: content generation, the slide renderer, export
pipeline, and the calendar all work end-to-end against real Claude calls — through a
secure server proxy, never a client-side key.

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
  the export SVG. Built to that spec. **Not exercised in this sandbox** (no network
  path to fonts.googleapis.com here) — needs a real-browser smoke test once deployed
  (export a deck, inspect a PNG for true Fraunces vs. a serif fallback).

## What's NOT ported (scoped out, not guessed at)

- **Video recording** (`recordVideo` / `MediaRecorder` / `wrapCanvasText`) — the
  Kinetic Video format's preview and poster-PNG export work; the "Record video
  (.webm)" capture button does not. Flagged rather than rushed.
- **`/calendar`'s own visual layout** — functional (real data, real actions) but its
  UI is my own construction, not a port, since I didn't have the original App's
  `view === "calendar"` JSX branch in view when I built it.

## Tests

`npm test` — 24 tests. Several are tied directly to named PRD §16 cases: the
`structureBody` failure string, the `"1,700+ GCCs. One critical gap"` stat-title
split, the mobility/AI-skills → talent lane-routing case, and the PDF builder's
xref-offset structural check.

## Setup

See the deploy walkthrough shared alongside this file — GitHub → Supabase → Vercel,
no local run needed. Quick reference if you do run locally:

1. `npm install`
2. Create a Supabase project, run `supabase/schema.sql` against it
3. Copy `.env.example` to `.env.local`, fill in Anthropic key, Supabase URL/service
   key, `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
4. Add each team member: `npm run add-user "name@kognozconsulting.com" "Their Name"` —
   omit the password and a strong one is generated and shown once. Pass a third argument
   to set a specific one, though it then lands in your shell history.

   The email domain does not matter here. The company-domain check applies only to Azure
   AD sign-ins, so this is also how you give access to someone outside the Microsoft
   tenant — they use the password form on `/login` rather than the Microsoft button.
5. `npm run dev`

**No keys or secrets are committed anywhere in this repo** — `.env.local` is
git-ignored, `.env.example` has empty values, and the only place secrets exist is
Vercel's environment variable settings (server-side only) and Supabase's own
dashboard.
