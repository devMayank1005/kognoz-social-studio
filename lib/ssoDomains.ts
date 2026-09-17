// Email domains allowed to sign in through Microsoft 365 (Entra ID). All of these are
// verified domains on the same Entra tenant pinned by AZURE_AD_TENANT_ID in lib/auth.ts.
// The password route in lib/auth.ts intentionally has no domain rule; see README.
export const ALLOWED_SSO_DOMAINS = ["kognozconsulting.com", "kognoz.com", "konverz.ai"] as const;

/**
 * True when `email` belongs to one of the allowed company domains.
 *
 * Matches on the full `@domain` suffix, so `user@kognoz.com.evil.tld` and
 * `kognoz.com@evil.tld` are rejected. Comparison is case-insensitive.
 */
export function isAllowedSsoEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? "").toString().trim().toLowerCase();
  if (!normalized) return false;
  return ALLOWED_SSO_DOMAINS.some((domain) => normalized.endsWith(`@${domain}`));
}
