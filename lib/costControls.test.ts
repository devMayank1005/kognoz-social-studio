import { describe, it, expect } from "vitest";
import {
  TOKENS,
  TASKS,
  PRICING,
  MODEL_ALLOWLIST,
  DEFAULT_MODEL_FOR_TASK,
  SEARCH_ALLOWED_TASKS,
  MAX_SEARCHES_PER_REQUEST,
  USD_PER_SEARCH,
  clampMaxTokens,
  costUsd,
  searchCount,
  isAllowedModel,
  searchToolLadder,
  THINKING
} from "./costControls";

describe("clampMaxTokens", () => {
  it("falls back to the per-task default when the client sends nothing", () => {
    expect(clampMaxTokens("generate")).toBe(TOKENS.generate.def);
    expect(clampMaxTokens("designNote")).toBe(TOKENS.designNote.def);
  });

  it("caps a client that asks for far more than the task needs", () => {
    // The pre-fix route passed body.maxTokens straight through, unbounded.
    expect(clampMaxTokens("generate", 200000)).toBe(TOKENS.generate.cap);
    expect(clampMaxTokens("caption", 999999)).toBe(TOKENS.caption.cap);
  });

  it("honours a smaller request from the client", () => {
    expect(clampMaxTokens("article", 500)).toBe(500);
  });

  it("ignores junk rather than sending it upstream", () => {
    for (const bad of [0, -1, NaN, Infinity, "2000", null, undefined, {}]) {
      expect(clampMaxTokens("revise", bad)).toBe(TOKENS.revise.def);
    }
  });

  it("floors fractional requests to a whole number of tokens", () => {
    expect(clampMaxTokens("revise", 900.7)).toBe(900);
  });

  it("never returns a value above the task cap, for any task", () => {
    for (const task of TASKS) {
      expect(clampMaxTokens(task, Number.MAX_SAFE_INTEGER)).toBe(TOKENS[task].cap);
      expect(clampMaxTokens(task)).toBeLessThanOrEqual(TOKENS[task].cap);
    }
  });
});

describe("token budgets", () => {
  it("gives every task headroom above its default so replies aren't truncated", () => {
    // Truncation is what pushed callClaudeJSON into a second paid call.
    for (const task of TASKS) {
      expect(TOKENS[task].cap).toBeGreaterThanOrEqual(TOKENS[task].def);
    }
  });

  it("keeps generate above the old flat 1000 that was truncating decks", () => {
    expect(TOKENS.generate.def).toBeGreaterThan(1000);
  });
});

describe("model configuration", () => {
  it("defaults every sonnet task to the cheaper sonnet-5", () => {
    for (const task of TASKS) {
      const model = DEFAULT_MODEL_FOR_TASK[task];
      expect(model).not.toBe("claude-sonnet-4-6");
      expect(isAllowedModel(model)).toBe(true);
    }
  });

  it("prices every allowlisted model", () => {
    for (const model of MODEL_ALLOWLIST) {
      expect(PRICING[model].in).toBeGreaterThan(0);
      expect(PRICING[model].out).toBeGreaterThan(0);
    }
  });

  it("prices sonnet-5 below sonnet-4-6 on both input and output", () => {
    expect(PRICING["claude-sonnet-5"].in).toBeLessThan(PRICING["claude-sonnet-4-6"].in);
    expect(PRICING["claude-sonnet-5"].out).toBeLessThan(PRICING["claude-sonnet-4-6"].out);
  });

  it("rejects anything outside the allowlist, including opus", () => {
    expect(isAllowedModel("claude-opus-5")).toBe(false);
    expect(isAllowedModel("")).toBe(false);
  });
});

describe("search gating", () => {
  it("only permits search on the two grounded tasks", () => {
    expect(SEARCH_ALLOWED_TASKS).toEqual(["generate", "verify"]);
  });

  it("caps searches per request", () => {
    expect(MAX_SEARCHES_PER_REQUEST).toBeLessThanOrEqual(2);
  });
});

describe("searchCount", () => {
  it("reads the server_tool_use counter", () => {
    expect(searchCount({ server_tool_use: { web_search_requests: 3 } })).toBe(3);
  });

  it("is zero when nothing searched", () => {
    expect(searchCount({ input_tokens: 100 })).toBe(0);
    expect(searchCount(undefined)).toBe(0);
    expect(searchCount(null)).toBe(0);
  });
});

describe("costUsd", () => {
  it("prices a plain sonnet-5 generation", () => {
    // 2000 in @ $2/M + 600 out @ $10/M
    const cost = costUsd("claude-sonnet-5", { input_tokens: 2000, output_tokens: 600 }, 0);
    expect(cost).toBeCloseTo(0.004 + 0.006, 10);
  });

  it("charges $10 per 1000 searches on top of tokens", () => {
    const tokensOnly = costUsd("claude-sonnet-5", { input_tokens: 1000, output_tokens: 0 }, 0);
    const withSearches = costUsd("claude-sonnet-5", { input_tokens: 1000, output_tokens: 0 }, 3);
    expect(withSearches - tokensOnly).toBeCloseTo(3 * USD_PER_SEARCH, 10);
  });

  it("shows the same call is cheaper on sonnet-5 than on sonnet-4-6", () => {
    const usage = { input_tokens: 2000, output_tokens: 600 };
    expect(costUsd("claude-sonnet-5", usage, 0)).toBeLessThan(costUsd("claude-sonnet-4-6", usage, 0));
  });

  it("prices cache reads far below fresh input", () => {
    const fresh = costUsd("claude-sonnet-5", { input_tokens: 10000 }, 0);
    const cached = costUsd("claude-sonnet-5", { cache_read_input_tokens: 10000 }, 0);
    expect(cached).toBeCloseTo(fresh / 10, 10);
  });

  it("treats missing usage fields as zero rather than NaN", () => {
    expect(costUsd("claude-haiku-4-5", undefined, 0)).toBe(0);
    expect(costUsd("claude-haiku-4-5", {}, 0)).toBe(0);
    expect(Number.isNaN(costUsd("claude-haiku-4-5", { input_tokens: undefined }, 1))).toBe(false);
  });

  it("shows a grounded call dwarfing a plain one", () => {
    // This ratio is the whole reason search gets its own rate-limit bucket.
    const plain = costUsd("claude-sonnet-5", { input_tokens: 2000, output_tokens: 600 }, 0);
    const grounded = costUsd("claude-sonnet-5", { input_tokens: 17000, output_tokens: 1500 }, 3);
    expect(grounded / plain).toBeGreaterThan(4);
  });
});

describe("searchToolLadder", () => {
  it("calls search directly — dynamic filtering is off after it measured slower and dearer", () => {
    // Measured: filtering ran 208s in half its runs and carried ~6,700 more input
    // tokens. Direct held 13-15s every time. See USE_DYNAMIC_FILTERING.
    const ladder = searchToolLadder("claude-sonnet-5");
    expect(ladder[0].allowed_callers).toEqual(["direct"]);
    expect(ladder.every((t) => (t.allowed_callers as string[] | undefined)?.[0] === "direct" || t.type === "web_search_20250305")).toBe(true);
  });

  it("never puts a code-execution-backed variant first while the flag is off", () => {
    for (const model of MODEL_ALLOWLIST) {
      expect(searchToolLadder(model)[0].allowed_callers).toEqual(["direct"]);
    }
  });

  it("caps searches on every rung — a fallback must not become an unbounded one", () => {
    for (const model of MODEL_ALLOWLIST) {
      for (const tool of searchToolLadder(model)) {
        expect(tool.max_uses).toBe(MAX_SEARCHES_PER_REQUEST);
        expect(tool.name).toBe("web_search");
      }
    }
  });

  it("always ends on the basic tool so there is a working last resort", () => {
    for (const model of MODEL_ALLOWLIST) {
      const ladder = searchToolLadder(model);
      expect(ladder[ladder.length - 1].type).toBe("web_search_20250305");
    }
  });
});

describe("thinking", () => {
  it("is explicitly disabled — sonnet-5 runs adaptive thinking when it is omitted", () => {
    // The regression this pins down: on sonnet-4-6 omitting `thinking` meant none;
    // on sonnet-5 omitting it means adaptive, billed as output tokens the client
    // then throws away, while eating the max_tokens budget and truncating the JSON.
    expect(THINKING).toEqual({ type: "disabled" });
  });
});

describe("clampMaxTokens — grounded headroom", () => {
  it("gives grounded generate more room than a plain one", () => {
    expect(clampMaxTokens("generate", undefined, true)).toBeGreaterThan(
      clampMaxTokens("generate", undefined, false)
    );
  });

  it("covers the output sizes real grounded calls actually produced", () => {
    // Logged calls returned 2,769 and 4,057 output tokens against a 2,400 cap.
    // A server-tool loop accumulates output across every internal turn.
    expect(clampMaxTokens("generate", 4057, true)).toBe(4057);
    expect(clampMaxTokens("verify", 4057, true)).toBe(4057);
  });

  it("still caps a grounded request rather than letting it run free", () => {
    expect(clampMaxTokens("generate", 999999, true)).toBe(TOKENS.generate.groundedCap);
  });

  it("leaves tasks that cannot search unaffected by the flag", () => {
    for (const task of ["revise", "caption", "article", "designNote"] as const) {
      expect(clampMaxTokens(task, undefined, true)).toBe(clampMaxTokens(task, undefined, false));
      expect(clampMaxTokens(task, 999999, true)).toBe(TOKENS[task].cap);
    }
  });
});
