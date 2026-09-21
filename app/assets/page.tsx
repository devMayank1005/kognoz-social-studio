"use client";

import { AppShell } from "@/components/shell/AppShell";
import { Placeholder } from "@/components/shell/Placeholder";
import { PageBody } from "@/components/shell/PageBody";

export default function Page() {
  return (
    <AppShell>
      <PageBody>
        <Placeholder
          title="Asset Library"
          summary="Images, logos and files your posts draw on."
          willInclude={[
            "Upload and organise images used in slides",
            "Reuse an image across decks without re-uploading",
            "Brand logos and motifs, versioned",
            "Track which asset appeared in which published post"
          ]}
          todayInstead="There is no file storage behind this yet — images are attached per slide in Studio and live inside the saved deck."
        />
      </PageBody>
    </AppShell>
  );
}
