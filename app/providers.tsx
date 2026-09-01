"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { setActivitySession } from "@/lib/activityClient";

/**
 * Keeps the activity logger pointed at the current sign-in.
 *
 * Renders nothing. It lives here, inside SessionProvider, so that every screen's
 * events carry the same sid without the export pipeline or the calendar having to
 * know that sessions exist.
 */
function ActivitySession() {
  const { data: session } = useSession();
  const sid = session?.user?.sid;

  useEffect(() => {
    setActivitySession(sid);
  }, [sid]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ActivitySession />
      {children}
    </SessionProvider>
  );
}
