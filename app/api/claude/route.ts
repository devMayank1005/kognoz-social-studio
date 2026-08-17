import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";

// PRD §3.1 + §13. This route is a dumb, hardened proxy: prompt TEXT itself
// (BRAND_CORE, lane context, format specs, LINE_RULE, grounding/voice blocks,
// contracts) is composed client-side, ported from kognoz-social-studio-v3.jsx —
// not available yet, so that composition layer (lib/promptBuilders.ts) doesn't
// exist here. This route only enforces the rules the PRD nails down: model
// allowlist, search gating, rate limit, spend logging, sanitized errors.

const MODEL_ALLOWLIST = ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"] as const;
type AllowedModel = (typeof MODEL_ALLOWLIST)[number];

type Task = "generate" | "revise" | "caption" | "article" | "verify" | "designNote";
const TASKS: Task[] = ["generate", "revise", "caption", "article", "verify", "designNote"];

// §6.5 default model per task when client doesn't pass one explicitly.
const DEFAULT_MODEL_FOR_TASK: Record<Task, AllowedModel> = {
  generate: "claude-sonnet-4-6",
  revise: "claude-haiku-4-5-20251001",
  caption: "claude-sonnet-4-6", // fresh default; client passes haiku explicitly for caption-revise (§6.5)
  article: "claude-sonnet-4-6",
  verify: "claude-sonnet-4-6",
  designNote: "claude-haiku-4-5-20251001"
};

// §3.1: useSearch only permitted for generate (grounded formats) and verify.
const SEARCH_ALLOWED_TASKS: Task[] = ["generate", "verify"];

const RATE_LIMIT_PER_HOUR = 60;

interface ClaudeRequestBody {
  task: Task;
  prompt: string;
  model?: string;
  maxTokens?: number;
  useSearch?: boolean;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userEmail = session.user.email;

  let body: ClaudeRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { task, prompt, useSearch = false } = body;

  if (!TASKS.includes(task)) {
    return NextResponse.json({ error: `Unknown task: ${task}` }, { status: 400 });
  }
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const model = body.model ?? DEFAULT_MODEL_FOR_TASK[task];
  if (!MODEL_ALLOWLIST.includes(model as AllowedModel)) {
    return NextResponse.json(
      { error: `Model not allowed: ${model}. Allowed: ${MODEL_ALLOWLIST.join(", ")}` },
      { status: 400 }
    );
  }

  if (useSearch && !SEARCH_ALLOWED_TASKS.includes(task)) {
    return NextResponse.json(
      { error: `useSearch not permitted for task "${task}". Allowed for: ${SEARCH_ALLOWED_TASKS.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  // Rate limit: 60 calls/hour per user (§3.1).
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("api_call_log")
    .select("id", { count: "exact", head: true })
    .eq("user_email", userEmail)
    .gte("created_at", oneHourAgo);

  if (countError) {
    // Visible failure, but don't hard-block the request over a logging-table issue.
    console.error("rate limit check failed", countError.message);
  } else if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: `Rate limit reached (${RATE_LIMIT_PER_HOUR}/hour). Try again shortly.` },
      { status: 429 }
    );
  }

  const maxTokens = useSearch ? 3000 : (body.maxTokens ?? 1000);

  const anthropicBody: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }]
  };
  if (useSearch) {
    anthropicBody.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server misconfigured: ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(anthropicBody)
    });
  } catch (e) {
    // §13: never expose raw provider errors with keys/headers. Network-level failure only.
    return NextResponse.json({ error: "Failed to reach Anthropic API", name: "NetworkError" }, { status: 502 });
  }

  const data = await anthropicRes.json();

  if (!anthropicRes.ok) {
    // Pass through the error TYPE/MESSAGE (useful, visible per product principle #4)
    // but never headers or the key.
    return NextResponse.json(
      { error: data?.error?.message ?? "Anthropic API error", type: data?.error?.type ?? "unknown" },
      { status: anthropicRes.status }
    );
  }

  // Spend logging (§3.1, §14 admin visibility) — best-effort, don't fail the request on log error.
  supabase
    .from("api_call_log")
    .insert({
      user_email: userEmail,
      task,
      model,
      input_tokens: data?.usage?.input_tokens ?? null,
      output_tokens: data?.usage?.output_tokens ?? null
    })
    .then(({ error }) => {
      if (error) console.error("spend log insert failed", error.message);
    });

  return NextResponse.json({ content: data.content, usage: data.usage });
}
