-- Add a login, from the Supabase SQL editor.
--
-- This table IS the allowlist — no row, no login. There is no public signup by design
-- (PRD §2), so this file and scripts/add-user.mjs are the only two supported ways in.
--
-- Use this file when you want the shortest route: paste, edit two values, run. Use
-- `npm run add-user "<email>" "<name>" instead when you would rather the password be
-- generated for you and never typed anywhere.
--
--   ⚠  The password below is typed in PLAINTEXT and Supabase keeps it in the SQL
--      editor's query history until you clear it. Clear that entry once you are done,
--      or use the npm script, which types nothing.
--
-- The email domain does not matter here. The company-domain check in lib/auth.ts runs
-- only for Azure AD sign-ins, so this is how you give access to someone outside the
-- Microsoft tenant. They sign in with the password form on /login, not the Microsoft
-- button.


-- 1. Hashing lives in the database, so no plaintext is ever stored.
--    Supabase ships pgcrypto; this is a no-op if it is already enabled.
create extension if not exists pgcrypto;


-- 2. Create the account. Replace the three values on the marked lines.
--
--    `username` is NOT NULL with no default, so it must be supplied. It is a short
--    lowercase handle (existing rows use "mayank", "yashwant") and is NOT used to sign
--    in — lib/auth.ts looks the account up by email. It just has to be present.
--
--    Everything else fills itself in: id, role ('member'), token_version,
--    failed_attempts, lockout_level and created_at all have defaults.
--
--    lower(trim(...)) is not cosmetic. lib/auth.ts lowercases the typed address and
--    does an exact match, so a row stored with ANY capital letter can never be found
--    by the password form. Two existing rows are stored capitalised and would fail to
--    sign in this way today; they use Microsoft SSO, which never reads this table.
--
--    gen_salt('bf', 12) produces a $2a$12$ hash. That is the same variant and cost
--    bcryptjs writes, and bcrypt.compare in lib/auth.ts verifies it directly.
insert into users (username, email, name, password_hash)
values (
  'theirhandle',                        -- <<< short handle, lowercase, e.g. "mayank"
  lower(trim('someone@example.com')),   -- <<< their email
  'Their Name',                         -- <<< their display name
  crypt('replace-with-a-strong-password', gen_salt('bf', 12))
);


-- 3. Check it landed. Deliberately does not select password_hash — there is no reason
--    to put a hash on screen, and screens get shared.
select email, name, created_at
from users
order by created_at desc
limit 5;


-- ---------------------------------------------------------------------------
-- RESETTING an existing password — run this ONLY when you mean to.
--
-- Kept separate from the insert above on purpose. Folding `on conflict do update`
-- into step 2 would mean a mistyped email silently overwrites a colleague's password
-- instead of failing, and the person would be locked out with nothing to explain it.
-- If step 2 errors with "duplicate key", that error is the feature: the account
-- already exists. Come here if you actually intend to change it.
-- ---------------------------------------------------------------------------

-- update users
--    set password_hash = crypt('their-new-password', gen_salt('bf', 12))
--  where email = lower(trim('someone@example.com'));


-- ---------------------------------------------------------------------------
-- REMOVING access.
--
-- Note this only stops the NEXT sign-in. Nothing re-checks the database once someone
-- holds a session, so an active session keeps working until its token expires.
-- ---------------------------------------------------------------------------

-- delete from users where email = lower(trim('someone@example.com'));
