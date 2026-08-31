# Deferred: hosted images, then session restore

**Status:** designed, not built. Parked deliberately before the Monday go-live.
**Recorded:** 31 August 2026, against `no-pagination` at `eed1bac`.

The ask was: refresh the page and pick up exactly where you left off. Investigating it
turned up two blockers that make it a bigger job than it looks, so it was parked. This note
exists so the work can be picked up cold rather than re-investigated.

## Where things stand today

Four things survive a reload:

| Key | Scope |
| --- | --- |
| `kognoz-design` | team-shared, via `/api/store` |
| `kognoz-house-prefs` | team-shared |
| `kognoz-style-memory` | team-shared |
| `kognoz-article-draft` | per-browser localStorage |

Everything else is lost on refresh: topic, the generated deck, photos, `seed`, and which
slide was on screen.

---

## Why this is two changes, in this order

### 1. Hosted images first

Photos are stored as raw data URLs and **nothing anywhere resizes or recompresses them** —
`FileReader.readAsDataURL` encodes the *original* file (`components/Slide.tsx:131-140`, and
the URL importer at `Studio.tsx:671-693`). A phone photo is 4–8 MB as a data URL, which
**exceeds the entire ~5 MB localStorage quota on its own**. A session blob containing one
cannot be written.

Worse, it would fail *silently*. Both `writeLocal` (`lib/storeClient.ts:50-52`) and
`saveArticleDraft` (`Studio.tsx:392-394`) swallow quota errors by design. Filling the quota
would quietly stop the store's offline cache updating — the exact failure mode the
`storeClient` header comment was written to prevent.

**Move images to Supabase Storage.** It is already in the project — `@supabase/supabase-js`,
existing credentials, same dashboard and bill. No new vendor. The session blob then holds a
~60-byte URL per image instead of megabytes, and the quota problem *disappears* rather than
being worked around. It also makes an uploaded photo visible to the rest of the team, which
matches how the calendar and design settings already behave.

> **Multer is not the tool here.** It is Express middleware that parses uploads onto local
> disk. This is Next.js on serverless: local disk does not survive between requests, and App
> Router route handlers do not take Express middleware.

**The constraint that makes hosting non-trivial.** Every PNG and PDF is produced by
rasterising the slide through a canvas, and `buildSlideSvg` inlines each `<img>` as base64
precisely because a remote URL would taint the canvas and break the export
(`lib/exportPipeline.ts:22-66`). That is *why* the URL importer already converts to a data
URL at import time. Hosting means fetching the image back and inlining it at export time,
which needs CORS on the bucket. Solvable — but it changes the code path that produces the
actual deliverable, which is why it must not ride on a go-live week.

### 2. Session restore on top

Once images are references rather than payloads, the session blob is small and the rest is
straightforward.

**Persist** — content the user would lose: `format`, `pillar`, `topic`, `eyebrow`, `cover`,
`slides`, `cta`, `scales`, `imgOn`, `ideaStyle`, `seed`, `lookI`, `article`, `current`, and
the image references.

**Do not persist** — `design`, `housePrefs`, `styleMem`. These are deliberately team-shared,
and the mount loader merges the server value over local state (`Studio.tsx:208-219`).
Restoring them locally would race that loader; `Studio.tsx:225-230` documents that race
having been fixed once already.

**Do not persist** — any `loading` / `busy` / `error` flag, or `winW`.

---

## Four ordering hazards that will bite

1. **`groundedTouched` and `captionTouched` are refs, not state** (`Studio.tsx:103`, `:175`).
   Both reset to `false` on reload, so the effects at `:345` and `:373` overwrite a restored
   `grounded` and `previewCaption` on mount. **The latches must be persisted alongside the
   values.** `grounded` is money — a grounded generation costs roughly 10× a plain one.

2. **The calendar-priming effect re-fires on refresh** (`Studio.tsx:881-935`). A session
   started from a calendar link keeps `?topic=&format=&pillar=&set=` in the URL, so a refresh
   re-runs the whole block and overwrites `format`, `ideaStyle`, `pillar`, `eyebrow`,
   `topic`, `current` and `grounded` — *after* any restore, since it sits later in source
   order. It also writes `design.set` back to the **team-shared** store. Unhandled, session
   restore looks broken for exactly the people using calendar links.

3. **The `current` clamp is one-way** (`Studio.tsx:341-343`). It fires on `deck.length`
   derived from whatever `slides`/`format` are in that commit, so restoring `current` before
   `slides` truncates it permanently. Restore them in the same commit.

4. **`slides !== DEFAULT_SLIDES` is a reference check** (`Studio.tsx:287`). An array
   deserialised from JSON is never identical to `DEFAULT_SLIDES`, so the first format switch
   after a restore always raises the stale-format warning, even when nothing was generated.

---

## Three decisions still open

Each carries a recommendation, to confirm when the work starts.

- **When a session will not fit.** Split text and images into separate keys so the writing —
  the part that cost money — always survives and only photos are dropped, with a notice.
  Largely moot once images are hosted, which is the argument for doing that first.

- **Calendar link vs saved session.** The link should win: clicking a calendar item is an
  explicit request for that item. Keep the saved deck and only replace it on an actual
  generate, so the click alone destroys nothing.

- **Starting something new.** If everything restores, Studio always opens on the last piece.
  One deliberate "clear and start new" control is needed. `startFresh` is **not** it
  (`Studio.tsx:495-503`) — it regenerates against the same topic and would not clear a
  persisted blob.

---

## Pieces to reuse

`lib/articleDraft.ts` is the working precedent: pure, I/O-free, unit-tested, with the
component holding only the localStorage call. A session module should follow that shape and
**absorb** the article draft rather than sitting beside it, so there is one restore path.

`lib/articleDraft.test.ts` asserts against the Studio source text, so **moving or renaming
the article-restore mount effect will break that test** — deliberately, so the wiring cannot
drift silently.

`storePeek` (`lib/storeClient.ts:76`) is exported with zero production call sites — a
ready-made seam for first-paint reads, though its own docstring warns it must never be the
basis for a write.

Nothing in the repo listens for `beforeunload`, `pagehide` or `visibilitychange`.
