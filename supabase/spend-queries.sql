-- Where the Anthropic money goes. Paste any block into the Supabase SQL Editor.

-- 0. THE ONE YOU'LL USE MOST: your last 15 calls, one row each, newest first.
--    `grounded` tells you whether web search actually ran — if it says false, the
--    "Ground with web search" box was not ticked, whatever the format was.
select to_char(created_at, 'MM-DD HH24:MI:SS') as when_,
       task,
       use_search                as grounded,
       coalesce(web_search_requests, 0) as searches,
       input_tokens              as tokens_in,
       output_tokens             as tokens_out,
       stop_reason,
       round(cost_usd::numeric, 5) as usd
from api_call_log
order by created_at desc
limit 15;

-- 1. Daily spend, split by whether web search was involved.
--    Grounded calls should be the minority; if they aren't, that's the bill.
select date_trunc('day', created_at)::date as day,
       count(*)                            as calls,
       count(*) filter (where use_search)  as grounded,
       sum(web_search_requests)            as searches,
       round(sum(cost_usd)::numeric, 4)    as usd
from api_call_log
where created_at > now() - interval '30 days'
group by 1 order by 1 desc;

-- 2. Cost per task, and what a single call of each actually costs you.
select task,
       count(*)                                as calls,
       round(avg(input_tokens))                as avg_in,
       round(avg(output_tokens))               as avg_out,
       round(sum(cost_usd)::numeric, 4)        as total_usd,
       round(avg(cost_usd)::numeric, 5)        as avg_usd
from api_call_log
where ok and created_at > now() - interval '30 days'
group by 1 order by total_usd desc nulls last;

-- 3. The grounded-vs-plain multiplier. This is the number that decides whether
--    the search toggle is earning its keep.
select use_search,
       count(*)                         as calls,
       round(avg(input_tokens))         as avg_in,
       round(avg(cost_usd)::numeric, 5) as avg_usd
from api_call_log
where ok and task = 'generate' and created_at > now() - interval '30 days'
group by 1;

-- 4. Truncation watch. Any row here means a reply hit the output cap and the
--    client had to buy a roomier retry — raise that task's cap in lib/costControls.ts.
select task, max_tokens, count(*)
from api_call_log
where stop_reason = 'max_tokens' and created_at > now() - interval '7 days'
group by 1, 2 order by 3 desc;

-- 5. Failures, which now get logged and now count against the rate limit.
select error_type, task, count(*)
from api_call_log
where not ok and created_at > now() - interval '7 days'
group by 1, 2 order by 3 desc;

-- 6. Is dynamic filtering paying for itself? It costs a fixed +3,148 input tokens
--    per grounded call (measured). If avg_in on grounded generates sits near or
--    below ~6,000, the overhead is winning and USE_DYNAMIC_FILTERING in
--    lib/costControls.ts should be flipped to false.
select round(avg(input_tokens)) as avg_in_grounded,
       round(avg(web_search_requests), 2) as avg_searches,
       count(*) as sample
from api_call_log
where ok and use_search and created_at > now() - interval '30 days';
