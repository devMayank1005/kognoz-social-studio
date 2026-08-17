import { Suspense } from "react";
import Studio from "@/components/Studio";

// Studio (/) — the deck editor. Real now: format/pillar/topic -> generate
// (via the secure /api/claude proxy) -> edit -> verify -> export. Wrapped in
// Suspense because Studio reads useSearchParams (Calendar's Create-> link).
export default function StudioPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48 }}>Loading Studio…</div>}>
      <Studio />
    </Suspense>
  );
}
