-- The working deck gets its own blob per brand.
--
-- Until now nothing about a deck survived a refresh: slides, images, per-slide text scale
-- and (as of the canvas editor) every hand-placed element lived only in React state. That
-- was tolerable while a deck was a few generated sentences you could regenerate in seconds.
-- It stopped being tolerable the moment people could spend half an hour positioning things.
--
-- Rewrites store_key_check in full rather than adding to it: a CHECK constraint cannot be
-- extended in place, and lib/storeKeys.test.ts reads the NEWEST constraint in this folder
-- and asserts it matches STORE_KEYS exactly. Adding a key means editing lib/supabase.ts,
-- supabase/schema.sql and a migration like this one, or that test fails.

alter table store drop constraint if exists store_key_check;

alter table store add constraint store_key_check check (
  key in (
    'kognoz-calendar',
    'kognoz-house-prefs',
    'kognoz-style-memory',
    'kognoz-design',
    'kognoz-voice-samples',
    'kognoz-market-scan',
    'kognoz-deck',
    'konverz-calendar',
    'konverz-house-prefs',
    'konverz-style-memory',
    'konverz-design',
    'konverz-voice-samples',
    'konverz-market-scan',
    'konverz-deck',
    'studio-brand'
  )
);

-- Seeded empty so a first read returns {} rather than "no such row", which the client
-- would otherwise report as the server being unreachable.
insert into store (key, value) values
  ('kognoz-deck', '{}'::jsonb),
  ('konverz-deck', '{}'::jsonb)
on conflict (key) do nothing;
