-- Kognoz Social Studio — Supabase schema

-- Users — simple username/password auth (no OAuth/email-provider dependency;
-- M365-hosted mail wasn't compatible with Google OAuth, and magic link needs an
-- email service; admin-managed credentials instead). This table IS the allowlist:
-- no row, no login. Passwords are bcrypt hashes, never plaintext — see
-- scripts/add-user.mjs, the only supported way to create one.
create table if not exists users (
  email text primary key,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table users enable row level security;
-- No public policies — only the server route (service-role key) reads this table.

-- Replaces artifact window.storage with shared server storage (PRD §3.2).
-- Same key semantics as v3: GET/PUT /api/store?key=... , JSON values, last-write-wins.
create table if not exists store (
  key text primary key check (
    key in ('kognoz-calendar', 'kognoz-house-prefs', 'kognoz-style-memory', 'kognoz-design')
  ),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text -- user email, for "who edited last" (P2 nicety, §15) — populate now, surface later
);

-- Row Level Security on; no public policies. All access goes through the
-- server route using the service-role key, which bypasses RLS by design.
-- This just makes sure no client-side anon-key access is ever possible.
alter table store enable row level security;

-- Seed empty rows so GET never 404s on first run (client can PUT to fill them).
insert into store (key, value) values
  ('kognoz-calendar', '{}'::jsonb),
  ('kognoz-house-prefs', '{}'::jsonb),
  ('kognoz-style-memory', '{}'::jsonb),
  ('kognoz-design', '{}'::jsonb)
on conflict (key) do nothing;

-- Optional (P1/P2): API call log for admin spend visibility (§3.1, §14).
create table if not exists api_call_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_email text not null,
  task text not null,
  model text not null,
  input_tokens int,
  output_tokens int
);

-- Cost telemetry (added with the spend-reduction pass). Every column is
-- nullable / additive so this is safe to run against an existing table.
-- `use_search` is what the hourly web-search bucket counts; `ok` distinguishes
-- billed successes from failed attempts, which are logged too so that retries
-- and errors still count against the rate limit.
alter table api_call_log add column if not exists use_search boolean not null default false;
alter table api_call_log add column if not exists ok boolean not null default true;
alter table api_call_log add column if not exists max_tokens int;
alter table api_call_log add column if not exists stop_reason text;
alter table api_call_log add column if not exists error_type text;
alter table api_call_log add column if not exists cache_creation_input_tokens int;
alter table api_call_log add column if not exists cache_read_input_tokens int;
alter table api_call_log add column if not exists web_search_requests int;
alter table api_call_log add column if not exists cost_usd numeric(10, 6);

-- The rate limiter counts rows per user over a rolling window on every call,
-- and the search bucket filters on use_search.
create index if not exists api_call_log_user_time_idx on api_call_log (user_email, created_at desc);
create index if not exists api_call_log_search_idx on api_call_log (user_email, created_at desc) where use_search;

alter table api_call_log enable row level security;
