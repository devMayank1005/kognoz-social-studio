-- Activity tracking for Social Studio (2026-09-01).
-- Safe to run more than once: every statement is idempotent.
-- Paste into the Supabase SQL Editor and Run.
--
-- ⚠  THIS PROJECT IS SHARED WITH ANOTHER APP — DO NOT ASSUME A TABLE IS OURS.
--
--    This Supabase project also backs "Team Pulse". These tables belong to it:
--
--      audit_log           Team Pulse's own activity trail, written continuously
--      login_ip_throttle   Team Pulse's brute-force throttle
--      tasks               Team Pulse's task board
--      users               SHARED — both apps read it, Team Pulse also writes it
--
--    This migration creates ONE NEW TABLE and one read-only VIEW. It does not
--    alter, drop, read or write ANY table above. Social Studio's activity screen
--    shows Social Studio only.
--
--    If a future change here ever needs to touch one of those tables, stop: Team
--    Pulse's code is not in this repository, so there is no way to test what the
--    change does to it.


-- ---------------------------------------------------------------------------
-- 1. The table.
--
-- One row per meaningful action. Deliberately NOT one row per page view or
-- keystroke: a trail nobody can read is a trail nobody reads.
--
-- Generations are absent by design — api_call_log already records every one with
-- its user, task, model and cost. Logging them twice would double-count spend.
-- ---------------------------------------------------------------------------
create table if not exists studio_activity (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),

  -- Who. Email, because that is what NextAuth gives us for BOTH sign-in paths.
  -- Microsoft SSO users have no row in `users`, so a uuid actor_id would be null
  -- for nearly every person here.
  actor_email  text not null,
  actor_name   text,

  -- What. Constrained to the allowlist in lib/activityEvents.ts, enforced by the
  -- API route rather than a CHECK constraint: adding an action should be a code
  -- change with a test, not a migration on a shared database.
  action       text not null,

  entity       text,   -- 'session' | 'content' | 'export' | 'calendar'
  entity_id    text,   -- ContentItem.id, where there is one
  entity_label text,   -- human label, e.g. the post topic
  screen       text,   -- 'login' | 'studio' | 'calendar' | 'admin'

  -- Where from. IP is the network, not the person: office addresses are shared
  -- and mobile addresses change. Useful as corroboration, not as proof.
  ip           text,
  user_agent   text,

  -- Groups one sign-in's events into a visit, so the timeline can show
  -- "signed in at 14:22, did these six things, signed out at 15:03".
  session_id   text,

  meta         jsonb
);

-- The admin view filters by person and reads newest-first; the second index
-- serves the unfiltered "everyone, last 7 days" default.
create index if not exists studio_activity_actor_time_idx on studio_activity (actor_email, created_at desc);
create index if not exists studio_activity_time_idx       on studio_activity (created_at desc);

-- No public policies, matching `store` and `users`. Every read and write goes
-- through a server route holding the service-role key, which bypasses RLS by
-- design. This only guarantees the anon key can never reach it.
alter table studio_activity enable row level security;


-- ---------------------------------------------------------------------------
-- 2. One timeline.
--
-- Social Studio's own activity, plus its API spend, in a single shape — so the
-- admin route reads ONE relation and cannot accidentally omit a source. A
-- generation therefore sits in the timeline right beside the download it
-- produced, which is the pairing that makes the trail worth reading.
--
-- Reads nothing outside this app.
--
-- The DROP is required, not tidiness. An earlier version of this file shipped a
-- view that also unioned Team Pulse's audit_log and carried an extra `source`
-- column. `create or replace view` CANNOT remove a column — Postgres rejects it
-- with "cannot change name of view column" — so replacing that shape in place is
-- impossible. Dropping first also makes this file re-runnable from either
-- starting state, which is the whole point of an idempotent migration.
--
-- Safe: this drops a VIEW this migration created, never a table, and nothing
-- else in either app depends on it.
-- ---------------------------------------------------------------------------
drop view if exists v_all_activity;

create view v_all_activity as
  select
    sa.created_at,
    sa.actor_email        as who,
    sa.actor_name,
    sa.action,
    sa.entity,
    sa.entity_label,
    sa.screen,
    sa.ip,
    sa.user_agent,
    sa.session_id,
    sa.meta
  from studio_activity sa

  union all

  -- Spend. api_call_log has no ip or session_id — it predates this trail and was
  -- built to answer "what did we spend", not "who was where". The nulls are
  -- honest: the row genuinely does not know.
  select
    l.created_at,
    l.user_email,
    null::text,
    'generate'::text,
    'generation'::text,
    l.task,
    'studio'::text,
    null::text,
    null::text,
    null::text,
    jsonb_build_object(
      'task', l.task,
      'model', l.model,
      'cost_usd', l.cost_usd,
      'ok', l.ok,
      'output_tokens', l.output_tokens,
      'stop_reason', l.stop_reason
    )
  from api_call_log l;


-- ---------------------------------------------------------------------------
-- 3. Retention. RUN THIS ON A SCHEDULE — it is not automatic.
--
-- IP address and user agent are personal data under GDPR and India's DPDP Act.
-- Keeping them forever is a liability with no operational benefit; six months is
-- long enough to investigate anything you would actually investigate.
--
-- Run monthly by hand, or schedule it with pg_cron if the project has it enabled.
-- Commented out so that running this file never deletes anything unexpectedly.
-- ---------------------------------------------------------------------------

-- delete from studio_activity where created_at < now() - interval '180 days';


-- ---------------------------------------------------------------------------
-- 4. Check it landed.
--
-- The last two counts are the point: they belong to Team Pulse and must match
-- what they were before this file ran. This migration must be invisible to it.
-- ---------------------------------------------------------------------------
select 'studio_activity (new, empty)' as check, count(*) from studio_activity
union all select 'v_all_activity (activity + spend)', count(*) from v_all_activity
union all select 'audit_log (Team Pulse — must be unchanged)', count(*) from audit_log
union all select 'tasks (Team Pulse — must be unchanged)', count(*) from tasks;
