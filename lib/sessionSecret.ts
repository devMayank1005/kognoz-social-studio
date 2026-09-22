// Where the session signing secret comes from, and the one place that decides.
//
// WHAT THIS REPLACES. middleware.ts and lib/auth.ts each carried this line:
//
//   process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "<a literal in the repo>"
//
// which means a missing environment variable did not fail — it fell back to a string
// anybody with the repository can read. Both the signer and the verifier used it, so a
// forged token would have been accepted: past the middleware, past getServerSession in all
// four routes, and past isAdmin(), which answers with colleagues' addresses and movements.
//
// lib/adminAccess.ts states the house rule for exactly this situation: "An unset or empty
// allowlist denies EVERYONE... Failing closed makes that a support ticket instead of a
// breach." A fallback secret is the opposite of failing closed, so it is gone.
//
// Edge-runtime safe on purpose: middleware.ts runs there, so nothing here may touch node.

/** Obvious on sight in a log, a cookie, or a stack trace. Never reachable in production. */
export const DEV_SECRET = "insecure-development-only-session-secret";

/**
 * Resolve the secret, or refuse.
 *
 * Pure and parameterised so the production branch can be tested without setting real
 * environment variables — the branch that matters is the one that is hardest to reach by
 * accident.
 */
export function resolveSessionSecret(
  env: { NEXTAUTH_SECRET?: string; AUTH_SECRET?: string } = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV
): string {
  const set = env.NEXTAUTH_SECRET?.trim() || env.AUTH_SECRET?.trim();
  if (set) return set;

  if (nodeEnv === "production") {
    // Loud and fatal. A deployment that cannot sign sessions safely should not serve them.
    throw new Error(
      "NEXTAUTH_SECRET is not set. Sessions cannot be signed safely, so the app refuses to " +
        "start rather than fall back to a shared secret. Set NEXTAUTH_SECRET in the deployment's " +
        "environment variables."
    );
  }

  console.warn(
    "[auth] NEXTAUTH_SECRET is not set — using a development-only secret. " +
      "This would refuse to start in production."
  );
  return DEV_SECRET;
}

/** Resolved once, at module load, so a misconfigured deployment fails at boot. */
export const SESSION_SECRET = resolveSessionSecret();
