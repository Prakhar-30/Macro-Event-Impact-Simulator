# Interview notes

Anticipated hard questions and crisp answers. The goal is not to memorize
canned responses — it is to make sure I can defend every component of the
system in a 45-minute conversation. Read once, internalize the why, then
answer naturally.

---

## "Isn't this just a chatbot with extra steps?"

No. A chatbot with tools would let the LLM do the math. Here the LLM does
not do the math. Six deterministic tools compute classification, retrieval,
aggregation, and citation. The agent's only job is to decide *which tool to
call next* and *write a paragraph at the end*. Every numeric claim in the
output traces back to a row in `historical_events` or `event_reactions`,
not to an LLM hallucination. The full pipeline runs end-to-end without any
LLM in the loop — that's the eval baseline mode, and it produces coherent
output for every scenario.

## "How do you know your impact estimates are right?"

I don't, and I don't claim to. The system never says "the impact will be X."
It says "across N curated historical analogs that share the input scenario's
tags, the median move was X, the range was Y to Z, and this is not a
prediction." That framing is enforced in three layers: the system prompt,
a regex eval, and an optional LLM-judge. The honesty constraint is the
project's most defensible feature.

## "Why curated events instead of a real factor model?"

Because building a real factor model honestly is a year of work, and pretending
to build one in three weeks would be intellectually dishonest. A small,
hand-curated event database is *defensible*: I can point at every row, justify
its tags, and explain the methodology. The trade-off is explicit in `DATA.md`:
small + honest beats broad + hand-wavy for a demo. The architecture would
let me swap a real model in behind the same tool interface — see
`packages/tools/src/portfolio_exposures.ts` for the seam.

## "Why prompt caching? When does it help?"

Two-pronged: (1) it cuts cost per run by ~70% on the static portion of the
prompt — system prompt + portfolio context. (2) It makes the agent feel
faster because iteration 2+ TTFT is lower. The tradeoff is a 5-minute TTL
that I have to design around — for one scenario run that's never an issue.
The numbers are in `COSTS.md`.

## "What if Yahoo Finance changes their API?"

The market-data layer is an isolated module (`apps/web/src/lib/prices.ts`
+ `scripts/pull-reactions.ts`). All Yahoo responses are persisted to
`data/cache/`, so the seeded reactions table is independent of Yahoo
availability after first pull. Live quotes degrade gracefully — if the
fetch fails we render `—` instead of crashing.

## "Why a separate worker instead of doing the agent loop in a Next.js API route?"

Three reasons. (1) Agent runs are 10-30 second long; Vercel's hobby plan
caps function timeouts at 10 seconds. (2) Putting them in a queue makes the
web tier stateless and horizontally scalable independently. (3) BullMQ +
Redis pub/sub gives us a natural seam for retries, replay-on-reconnect via
the `job_events` table, and concurrency limits.

## "Walk me through what happens when I click 'Run scenario'."

1. The client `POST`s `/api/scenarios` with portfolio id + scenario text.
2. The route inserts a `jobs` row, enqueues a BullMQ job, returns the job id.
3. The client opens an `EventSource` to `/api/scenarios/:id/stream`.
4. That route auth-checks then proxies the worker's SSE.
5. The worker's BullMQ Worker picks up the job, calls `runAgent()`.
6. `runAgent` runs the Anthropic Messages tool-use loop. For every event
   (tool_use, tool_result, text delta, finish), it calls `onEvent`.
7. `onEvent` publishes to Redis pub/sub channel `macroscope:job:<id>` AND
   inserts a `job_events` row.
8. The worker's `/jobs/:id/stream` route subscribes to that pub/sub channel,
   replays prior `job_events` rows, then pumps live messages to the SSE
   client.
9. The client renders each tool call as a card, streams text into the
   briefing area, freezes on `agent_finish`.

## "What's the failure mode you're most worried about?"

Two. (1) The classifier silently maps a novel scenario to wrong tags →
analogs are the wrong shape → impact estimate is misleading. The defence
is the eval harness: 16 scenarios with `mustClassifyTags` and
`mustNotClassifyTags`, including a deliberate-irrelevant-text test.
When that fails, I extend the classifier (the regex rules in
`classify_scenario.ts`), I don't prompt-engineer the LLM. (2) Position
coverage gaps quietly under-state the impact — if AAPL has a reaction in
event X but XOM doesn't, the portfolio median is computed only on AAPL.
The defence is `positionsWithoutCoverage`, surfaced in every output and
required in the briefing's caveats section.

## "What would you do next?"

In priority order:
1. Wire the news archive ingestion (GDELT + Wikipedia event articles)
   so `search_news_archive` actually returns headlines.
2. Add a second LLM call path: when the rule-based classifier returns
   confidence 0, fall back to an LLM classifier with the canonical
   tag enum. Run only on no-match cases — keeps cost down.
3. Expand the curated event set from 30 to ~80 events.
4. Add a per-position `country_revenue` curated dataset for the top
   names so geographic exposure becomes meaningful.
5. Add a real exposure-derivation prototype using SEC EDGAR 10-Ks for
   a small subset of names — explicitly framed as research, not the
   default path.

## "Why TypeScript everywhere?"

For a portfolio project that pairs a frontend, a backend, and an agent
runtime, single-language reduces friction more than language-fit gains
matter. A shared `packages/db` Drizzle schema is consumed by both the
Next.js app and the Hono worker as plain TS — no codegen step, no
serialization at the workspace boundary. The agent loop is built on
`@anthropic-ai/sdk` which is TS-first.

## "Why did you not use [LangChain | LlamaIndex | etc]?"

Because the agent loop in `packages/agent/src/loop.ts` is ~150 lines of
TS that calls `messages.create` and dispatches tool blocks. Using a
framework would obscure that, give me less control over caching and
streaming, and add a layer of abstraction I'd have to learn and explain.
The Anthropic SDK is intentionally low-level enough to do this directly.

## "Can I see the costs?"

Yes — every job persists `inputTokens`, `outputTokens`, `cacheReadTokens`,
`cacheWriteTokens`, plus the timestamps. The eval harness summarizes them
per scenario. `COSTS.md` has the math. Typical run is well under $0.50
at list price.
