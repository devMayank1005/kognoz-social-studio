-- Cost telemetry for api_call_log (spend-reduction pass, 2026-08-26).
-- Safe to run more than once: every statement is idempotent.
-- Paste into the Supabase SQL Editor and Run.

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
