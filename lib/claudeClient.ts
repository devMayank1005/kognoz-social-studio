// Client-side Claude caller — ported from kognoz-social-studio-v3.jsx's
// callClaudeJSON/callClaudeText, but re-pointed at OUR /api/claude proxy
// instead of https://api.anthropic.com directly.
//
// Why this had to change (not just a style choice): the reference jsx's
// direct fetch to api.anthropic.com carries no API key at all — it only
// works inside the Claude-artifact sandbox, where the platform injects
// access for the running artifact. There is no such sandbox in a standalone
// deploy. The key lives in Vercel's server env only (see .env.example) and
// is never sent to, or readable from, the browser. This file never touches
// it — every call here is a same-origin fetch to our own Next.js route.
"use client";

export type ClaudeTask = "generate" | "revise" | "caption" | "article" | "verify" | "designNote";

export const FAST_MODEL = "claude-haiku-4-5-20251001";

interface CallOpts {
  model?: string;
  maxTokens?: number;
  useSearch?: boolean;
}

async function callProxy(task: ClaudeTask, prompt: string, opts: CallOpts = {}): Promise<string> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, prompt, model: opts.model, maxTokens: opts.maxTokens, useSearch: opts.useSearch })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  const content = (data.content || []) as { type: string; text?: string }[];
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("");
}

// Tolerant JSON extraction + one corrective retry — same contract as the
// reference implementation's callClaudeJSON.
export async function callClaudeJSON(task: ClaudeTask, prompt: string, opts: CallOpts = {}): Promise<any> {
  const extract = (text: string) => {
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    if (a === -1 || b <= a) throw new Error("no json");
    return JSON.parse(text.slice(a, b + 1));
  };
  try {
    return extract(await callProxy(task, prompt, opts));
  } catch {
    const fixed = await callProxy(
      task,
      prompt + "\n\nIMPORTANT: your previous reply was not valid JSON. Return ONLY the JSON object, nothing else.",
      opts
    );
    return extract(fixed);
  }
}

// Network-level retry (single backoff) — same contract as callClaudeText.
export async function callClaudeText(task: ClaudeTask, prompt: string, opts: CallOpts = {}): Promise<string> {
  const ask = async () => {
    const text = (await callProxy(task, prompt, opts)).trim();
    if (!text) throw new Error("empty reply from the model");
    return text;
  };
  try {
    return await ask();
  } catch {
    await new Promise((r) => setTimeout(r, 700));
    return await ask();
  }
}
