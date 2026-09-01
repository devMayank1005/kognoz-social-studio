-- Activity tracking for Social Studio (2026-09-01).
-- Safe to run more than once: every statement is idempotent.
-- Paste into the Supabase SQL Editor and Run.
--
-- ⚠  READ THIS FIRST — THIS PROJECT IS SHARED WITH ANOTHER APP.
--
--    This Supabase project also backs "Team Pulse". Those tables are NOT ours:
--
--      audit_log           Team Pulse's own activity trail, written continuously
--      login_ip_throttle   Team Pulse's brute-force throttle
--      tasks               Team Pulse's task board
--      users               SHARED — both apps read it, Team Pulse also writes it
--
--    This migration CREATES ONE NEW TABLE and one read-only VIEW. It does not
--    alter, drop or write to any table above. The view READS audit_log so you get
--    one timeline per person across both products; Team Pulse's rows are never
--    modified and its own screens are unaffected.
--
--    That restraint is deliberate. Adding a column to audit_log would have been
--    tidier, but Team Pulse's code is not in this repository, so there is no way
--    to test what such a change does to its admin screens.


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
  -- Microsoft SSO users have no row in `users`, so a uuid actor_id — the shape
  -- audit_log uses — would be null for nearly every person here.
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
-- 2. One timeline out of three sources.
--
-- Folds this app's activity, its API spend, and Team Pulse's audit trail into a
-- single shape so the admin route reads ONE relation and cannot accidentally
-- omit a source.
--
-- `who` is an email for Social Studio rows and a short handle ('mayank') for
-- Team Pulse rows, because that is what each app stores. Matching a person
-- across the two is therefore best-effort — the admin screen filters on text and
-- shows the source, rather than pretending the two identifier spaces are one.
-- ---------------------------------------------------------------------------
create or replace view v_all_activity as
  select
    'studio'::text        as source,
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

  -- Spend. Mapped into the same shape so a generation sits in the timeline
  -- beside the download it produced.
  select
    'studio'::text,
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
  from api_call_log l

  union all

  -- Team Pulse. Read-only. Its `action` is already a written sentence, so it
  -- passes through as the label rather than being re-worded.
  select
    'team-pulse'::text,
    a.created_at,
    a.username,
    null::text,
    'team_pulse_event'::text,
    a.entity,
    a.action,
    a.screen,
    a.ip,
    a.user_agent,
    null::text,
    null::jsonb
  from audit_log a;


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
-- 4. Check it landed, and check we broke nothing.
--
-- The second and third counts are the point: they must match what they were
-- before this file ran. This migration must be invisible to Team Pulse.
-- ---------------------------------------------------------------------------
select 'studio_activity' as table_name, count(*) from studio_activity
union all select 'audit_log (Team Pulse — must be unchanged)', count(*) from audit_log
union all select 'tasks (Team Pulse — must be unchanged)', count(*) from tasks
union all select 'v_all_activity (all three sources)', count(*) from v_all_activity;
