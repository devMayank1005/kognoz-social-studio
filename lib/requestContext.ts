// Carrying the request's origin into NextAuth's callbacks.
//
// The problem this solves: NextAuth v4 gives `events.signIn` / `events.signOut` and the
// `signIn` callback no request object, so there is no way to see the caller's IP or
// device from inside them — which is precisely where sign-ins are known about.
// `authorize()` does receive one, but only for the password provider, so relying on it
// would mean Microsoft sign-ins were logged without an address.
//
// AsyncLocalStorage gives one uniform answer for both providers: the route handler
// stashes the origin before invoking NextAuth, and anything running inside that call
// can read it. Every route in this app is the Node runtime (no `export const runtime`),
// so node:async_hooks is available.
//
// Reading it returns `null` outside a request rather than throwing, so importing this
// from a callback that runs in some other context can never break a sign-in.

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestOrigin {
  ip: string;
  userAgent: string | null;
}

const storage = new AsyncLocalStorage<RequestOrigin>();

/** Run `fn` with the caller's origin visible to everything it awaits. */
export function withRequestOrigin<T>(origin: RequestOrigin, fn: () => T): T {
  return storage.run(origin, fn);
}

/** The current request's origin, or null when there is no request in scope. */
export function currentRequestOrigin(): RequestOrigin | null {
  return storage.getStore() ?? null;
}
