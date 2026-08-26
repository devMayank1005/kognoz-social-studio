-- Optimistic locking for the shared `store` blobs (2026-08-26).
-- Safe to run more than once.
--
-- Why: PUT /api/store was a blind upsert — the schema comment said
-- "last-write-wins" and meant it. With several admins editing the same calendar
-- blob, whoever saved second silently destroyed the other's work: no error, no
-- trace, no recovery. The blob's own `version: 3` field is a SCHEMA tag, not a
-- concurrency token, and the server never read it.
--
-- With this column the server can do a conditional update and return 409 instead
-- of overwriting, so a losing write is reported rather than swallowed.

alter table store add column if not exists version int not null default 1;
