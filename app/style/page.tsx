"use client";

import { AppShell } from "@/components/shell/AppShell";
import { Placeholder } from "@/components/shell/Placeholder";

export default function StylePage() {
  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Placeholder
        title="Style & Voice"
        summary="Where the model learns how Kognoz and Konverz actually write, and which words never get through."
        willInclude={[
          "Brand voice — paste real posts, articles and slide copy in bulk; they become the samples every generation imitates",
          "Humanise — rewrite generated text against those samples instead of the model's default register",
          "House rules — the tone setting and the active writing rules, editable",
          "Banned words — the slop linter's list, with additions and removals"
        ]}
        todayInstead="The engine behind all of this already runs: lib/voiceSamples.ts stores and picks the samples, and the slop linter enforces the banned list on every generation. What is missing is this screen to manage them."
        />
      </div>
    </AppShell>
  );
}
