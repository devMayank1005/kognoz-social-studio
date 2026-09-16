-- Widen store.key for the Konverz brand, the market scan, and the brand choice
-- (2026-09-16). Safe to run more than once. No data is touched; this only widens
-- a CHECK constraint and seeds empty rows.
--
-- WHY THIS IS URGENT RATHER THAN TIDY.
--
-- store.key carries a CHECK constraint listing five kognoz-* keys, and
-- app/api/store/route.ts carries the same list again in STORE_KEYS. The Konverz
-- brand shipped writing to konverz-* keys that were in neither. The route
-- rejected every one of them with 400 before the database was even reached, and
-- storeClient reports any non-OK response as unreachable — so the Konverz
-- calendar said "the server did not answer" when what actually happened was that
-- this app refused its own key. Design, house style, style memory and voice
-- samples failed the same way, silently.
--
-- The new keys, and what each is for:
--
--   konverz-calendar       the Konverz month plan
--   konverz-house-prefs    standing team preferences, Konverz
--   konverz-style-memory   the app's own past output, structure reference only
--   konverz-voice-samples  real published posts the edit pass imitates
--   konverz-design         design set, accent, website line
--   *-market-scan          current sourced market problems, per brand, that the
--                          month planner writes topics from
--   studio-brand           which brand a person last worked in; deliberately not
--                          brand-scoped
--
-- lib/storeKeys.test.ts parses THIS FILE and compares it to STORE_KEYS, so the
-- two cannot drift again without a test failing.

alter table store drop constraint if exists store_key_check;

alter table store add constraint store_key_check check (
  key in (
    'kognoz-calendar',
    'kognoz-house-prefs',
    'kognoz-style-memory',
    'kognoz-design',
    'kognoz-voice-samples',
    'kognoz-market-scan',
    'konverz-calendar',
    'konverz-house-prefs',
    'konverz-style-memory',
    'konverz-design',
    'konverz-voice-samples',
    'konverz-market-scan',
    'studio-brand'
  )
);

-- Seed empty rows so a first GET reads as empty rather than missing, matching how
-- the kognoz-* keys were seeded in schema.sql.
insert into store (key, value) values
  ('kognoz-market-scan', '{}'::jsonb),
  ('konverz-calendar', '{}'::jsonb),
  ('konverz-house-prefs', '{}'::jsonb),
  ('konverz-style-memory', '{}'::jsonb),
  ('konverz-design', '{}'::jsonb),
  ('konverz-voice-samples', '{}'::jsonb),
  ('konverz-market-scan', '{}'::jsonb),
  ('studio-brand', '{}'::jsonb)
on conflict (key) do nothing;
