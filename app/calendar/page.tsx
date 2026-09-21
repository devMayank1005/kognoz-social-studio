"use client";

import CalendarView from "@/components/calendar/CalendarView";
import { AppShell } from "@/components/shell/AppShell";
import { PageBody } from "@/components/shell/PageBody";

// The page-level header this used to carry — logo, "Back to Studio", the brand switch,
// the user pill, Sign out — now lives in the shell. Three screens each hand-rolled a
// version of it and they had already drifted apart.
export default function CalendarPage() {
  return (
    <AppShell>
      <PageBody>
        <CalendarView />
      </PageBody>
    </AppShell>
  );
}
