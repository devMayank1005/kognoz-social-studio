// Who may read the activity trail.
//
// An env allowlist, not a database role, and that is a considered choice rather than a
// shortcut. `users.role` exists and holds 'admin' for the two rows in it — but Microsoft
// SSO users have NO ROW IN `users` AT ALL. They are authenticated by Entra ID and the
// table is never consulted. So the database can only answer "is this person an admin"
// for people who sign in with a password, which is the minority and, right now, nobody
// who would be reading this screen.
//
// One mechanism that works identically for both sign-in paths beats two that disagree.
//
// Note the `users` table is shared with another app (Team Pulse), so its `role` column
// is not ours to reinterpret either.

/** Parse ADMIN_EMAILS: comma or whitespace separated, case- and space-insensitive. */
export function parseAdminEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

/**
 * Is this address an admin?
 *
 * An unset or empty allowlist denies EVERYONE. The tempting alternative — treat
 * "unconfigured" as "open" — would mean a deploy that forgot the variable silently
 * published every person's IP address and movements to anyone who could sign in.
 * Failing closed makes that a support ticket instead of a breach.
 */
export function isAdminEmail(email: string | null | undefined, raw: string | undefined | null): boolean {
  const allowed = parseAdminEmails(raw);
  if (!allowed.length) return false;
  const candidate = (email || "").trim().toLowerCase();
  if (!candidate) return false;
  return allowed.includes(candidate);
}

/** The check as the routes use it, reading the environment directly. */
export function isAdmin(email: string | null | undefined): boolean {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw || !parseAdminEmails(raw).length) {
    console.warn("ADMIN_EMAILS is not set — the activity screen is closed to everyone.");
    return false;
  }
  return isAdminEmail(email, raw);
}
