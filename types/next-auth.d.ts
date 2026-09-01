// Adds the sign-in id to NextAuth's types.
//
// `sid` is minted once per sign-in in the jwt callback and carried for the life of the
// session. It is what lets the activity trail group a person's actions into a visit —
// "signed in at 14:22, did these six things, signed out at 15:03" — instead of a flat
// list of events with no way to tell one sitting from the next.

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Sign-in id, stable for one session. See lib/auth.ts. */
      sid?: string;
      /** Whether this address is in ADMIN_EMAILS. For showing the link, not for access. */
      isAdmin?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sid?: string;
    isAdmin?: boolean;
  }
}
