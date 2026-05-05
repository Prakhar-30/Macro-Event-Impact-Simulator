# Architecture

This document walks one full request — *"Oil spikes to $150/bbl due to a Middle East refinery
attack"* — end-to-end through every component, so you can hold the system in your head.

## High-level

```
Browser (Next.js)
     │
     │  1. POST /api/scenarios     2. SSE /api/scenarios/:id/stream
     ▼
┌──────────────────────────┐
│  Next.js API routes      │   thin: auth, portfolio CRUD, job submit, SSE proxy
│  - apps/web              │
└────────────┬─────────────┘
             │ enqueue (BullMQ)
             ▼
┌──────────────────────────┐
│  Redis                   │   queue + pub/sub + BullMQ state
└────────────┬─────────────┘
             │ subscribe (BullMQ)
             ▼
┌──────────────────────────────────────────┐
│  Agent Worker (Hono + BullMQ)            │
│  - apps/worker                           │
│  ┌────────────────────────────────────┐  │
│  │  runAgent (Anthropic Messages API) │  │
│  │   ↓ tool_use / tool_result loop    │  │
│  │   ↓ Opus 4.7 + prompt caching      │  │
│  └────────────────────────────────────┘  │
│  Each AgentEvent published to Redis      │
│  channel + persisted to job_events for   │
│  replay-on-reconnect.                    │
└─────────┬────────────────────────────────┘
          │ Drizzle / postgres-js
          ▼
┌──────────────────────────────────────────┐
│  Postgres (pgvector)                     │
│   users · portfolios · positions         │
│   tickers (curated universe)             │
│   historical_events · event_reactions    │
│   news_chunks (vector)                   │
│   jobs · job_events                      │
└──────────────────────────────────────────┘
```

## Walk-through: one scenario request

### 1. User submits a scenario from `/portfolios/:id/run`
The client `POST`s `{portfolioId, scenario}` to `/api/scenarios`.

### 2. Web route (`apps/web/src/app/api/scenarios/route.ts`)
- Validates `scenarioText` with zod.
- Verifies the user owns the portfolio (Drizzle query).
- Inserts a `jobs` row with status `queued`.
- Enqueues a BullMQ job on the `scenario` queue (Redis).

### 3. Worker (`apps/worker/src/process-scenario.ts`)
- BullMQ delivers the job. The worker:
  - Marks `jobs.status = running`.
  - Pre-fetches positions for the portfolio so they can be cached in the prompt.
  - Calls `runAgent({ scenario, portfolioId, portfolioContext, onEvent })`.
- `onEvent` does two things for every `AgentEvent`:
  1. Publishes the event to Redis pub/sub channel `macroscope:job:<jobId>`.
  2. Inserts a `job_events` row (so a late-joining SSE client can replay).

### 4. Agent loop (`packages/agent/src/loop.ts`)

System prompt and portfolio context block are wrapped with
`cache_control: { type: "ephemeral" }` so subsequent iterations within the same
job hit the prompt cache.

Loop body:

```
while iter < maxIterations:
    resp = anthropic.messages.create({ model: opus-4.7, system, tools, messages })
    record token usage (incl. cache read/write)
    emit any text deltas

    if resp.stop_reason == "tool_use":
        for tool_use_block in resp:
            emit "tool_use"
            result = dispatchTool(name, input)
            emit "tool_result"
            append tool_result to messages
        continue
    else:
        emit "agent_finish" with finalText + cumulative usage
        break
```

`dispatchTool` (`packages/agent/src/tool-dispatch.ts`) routes the tool name
to one of six deterministic implementations in `@macroscope/tools`.

### 5. Deterministic tool layer (`packages/tools`)

For our oil-shock scenario, a typical agent trajectory:

1. `classify_scenario({text})` →
   `{ tags: ["oil_supply_shock", "geopolitical_middle_east", "commodity_spike"], confidence: 0.85, rationale: ... }`

2. `find_historical_analogs({tags, limit: 8})` →
   8 events ranked by tag overlap. Top hits include `russia_invades_ukraine_2022`
   and `hamas_attack_2023`.

3. `get_portfolio_exposures({portfolio_id})` →
   sector / country / thematic-tag breakdown.

4. `compute_position_impact({positions, horizon: "5d", event_ids})` →
   internally calls `get_analog_reactions` for the (events × tickers × horizon)
   slice, then aggregates into per-position median/p25/p75 + portfolio-level
   weighted summary.

5. (Optional) `search_news_archive({query})` → headlines for narrative color.

6. Final assistant turn: structured markdown briefing with `[event_id]`
   citations on every claim.

### 6. Streaming UI (`apps/web/src/.../scenario-runner.tsx`)
Client opens `EventSource('/api/scenarios/:id/stream')`. The route auth-checks,
then proxies the worker's SSE stream to the browser. Each `AgentEvent` kind
maps to a UI update:

- `tool_use` → adds a card; shows "running…"
- `tool_result` → flips card to done/failed; renders smart per-tool summary
- `model_text_delta` → appends to the streaming briefing area
- `agent_finish` → freezes final text + token-usage line

Citation chips in the final text are rendered by parsing `[event_id]` patterns
and looking the id up in the `find_historical_analogs` result captured during
the same stream — so they hover-display the real event title and date.

## Why this architecture

- **Web ↔ worker split**: agent runs are long-running (10-30s) and bursty.
  Putting them in a queue keeps the web tier stateless and Vercel-deployable.
  The worker can scale independently.
- **Tools as plain TS**: every tool is unit-testable without an LLM. The eval
  harness exploits this with a `--baseline` mode that runs the full pipeline
  with the rule-based classifier — a deterministic regression net that never
  costs an LLM token.
- **Redis pub/sub + job_events table**: the table replays prior events when a
  client reconnects mid-run; pub/sub streams live ones. SSE gets both for free.
- **Prompt caching**: system prompt and portfolio context are cache-hit
  candidates across the multi-turn tool-use loop within a single run.

## Files of interest

| Concern | File |
|---|---|
| Schema (single source of truth) | `packages/db/src/schema.ts` |
| Tool definitions for Claude | `packages/agent/src/tool-schemas.ts` |
| Agent loop | `packages/agent/src/loop.ts` |
| Tool implementations | `packages/tools/src/*` |
| Streaming SSE | `apps/worker/src/sse.ts` |
| Eval harness | `evals/run.ts` |
