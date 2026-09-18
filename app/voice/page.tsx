"use client";

import { AppShell } from "@/components/shell/AppShell";
import { Placeholder } from "@/components/shell/Placeholder";

export default function Page() {
  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Placeholder
          title="Brand Voice Samples"
          summary="Real writing by real people, which every generation imitates."
          willInclude={[
            "Paste posts, articles and slide copy in bulk, tagged by brand, channel and kind",
            "See which samples were actually picked for a given draft",
            "Remove a sample that is pulling the voice the wrong way",
            "The engine already runs: lib/voiceSamples.ts stores and picks the samples on every generation. What is missing is this screen to manage them."
          ]}
          todayInstead=""
        />
      </div>
    </AppShell>
  );
}
