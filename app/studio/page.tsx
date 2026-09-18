import { Suspense } from "react";
import Studio from "@/components/Studio";
import { StudioShell } from "./StudioShell";

// Studio — the deck editor. format/pillar/topic -> generate -> edit -> verify -> export.
//
// Moved here from `/` so it is one destination among six rather than the whole app.
// `/` now redirects here, so existing links and bookmarks still land in the right place.
//
// Suspense because Studio reads useSearchParams (the Calendar "Create →" link).
export default function StudioPage() {
  return (
    <StudioShell>
      <Suspense fallback={<div style={{ padding: 48 }}>Loading Studio…</div>}>
        <Studio />
      </Suspense>
    </StudioShell>
  );
}
