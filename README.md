# macroscope

> Macro Scenario Impact Simulator for Equity Portfolios.
> Describe a macro scenario in plain English. Get a portfolio-level impact estimate
> grounded in **historical analog events** — not a forecast.

This is a portfolio / resume-showcase project pairing full-stack engineering with applied LLM
agent design. Every estimate the system produces is framed as a median of N historical analogs
with explicit ranges. The system is intentionally honest about what it can and cannot do.

## Status

Milestones:

| # | Milestone | Status |
|---|-----------|--------|
| M1 | Foundation: Next.js + auth + portfolios + live prices | in progress |
| M2 | Curated event database + reactions seed | pending |
| M3 | Deterministic tool layer (no LLM in loop) | pending |
| M4 | Agent orchestration with Anthropic tool use | pending |
| M5 | Streaming UI — report page | pending |
| M6 | Eval harness | pending |
| M7 | Polish + writeup docs | pending |

## Stack

- **Language:** TypeScript everywhere
- **Frontend:** Next.js 14 App Router, Tailwind, shadcn-style primitives, SSE streaming
- **Backend:** Next.js API routes (thin) + a separate Hono worker for the agent loop
- **DB:** Postgres with `pgvector`, Drizzle ORM
- **Cache / queue:** Redis + BullMQ
- **LLM:** Anthropic API, model `claude-opus-4-7` for both classification and the agent loop,
  with prompt caching for the system prompt and the analogs context
- **Market data:** `yahoo-finance2` (free, sufficient for portfolio-level demo)
- **Tests:** vitest

## Repo layout

```
apps/
  web/         Next.js app (UI + thin API)
  worker/      Hono worker for the agent loop + BullMQ jobs
packages/
  db/          Drizzle schema + migrations + client
  tools/       Deterministic tool layer (M3) — unit-testable without an LLM
  agent/       LLM client, prompts, tool-use orchestration (M4)
seed/          Curated SQL — events, exposures (M2)
scripts/       One-off pulls (e.g. event reactions from yahoo-finance2)
evals/         Scenario evals (M6)
```

## Running locally

Prereqs: Node 22, pnpm 10, and a Postgres 15+ with the `vector` extension enabled.
A `docker-compose.yml` is provided for local Postgres + Redis (uses `pgvector/pgvector:pg16`),
but you can also point `DATABASE_URL` and `REDIS_URL` at any cloud instance.

```bash
# 1. install
pnpm install

# 2. infra (optional — only if you want local docker)
pnpm infra:up

# 3. env
cp .env.example .env
# fill in ANTHROPIC_API_KEY at minimum; GitHub OAuth optional in dev

# 4. db
pnpm db:generate   # generate SQL migrations from drizzle schema
pnpm db:migrate    # apply migrations + create vector extension

# 5. dev
pnpm dev           # web on :3000, worker on :4000
```

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — full system + walk-through of one request
- [`DATA.md`](./DATA.md) — what's real, what's curated, what's known approximate
- [`AGENT.md`](./AGENT.md) — prompt design, tool design, why this isn't a chatbot
- [`EVALS.md`](./EVALS.md) — eval methodology + how to run
- [`COSTS.md`](./COSTS.md) — measured token cost per run + caching savings
- [`INTERVIEW_NOTES.md`](./INTERVIEW_NOTES.md) — anticipated hard questions + crisp answers
- [`DEMO.md`](./DEMO.md) — 2-minute demo script

## Honesty constraint

The system **does not predict markets**. Every estimate is framed as
"based on N historical analogs with similar exposures, the median move was X,
the range was Y to Z — this is NOT a prediction."

- Forecasting language is cut from prompts.
- The eval harness has a judge check for honesty-constraint adherence.
- UI copy uses "historical analog estimate", never "predicted impact".

## Data philosophy

This project deliberately uses a **small, hand-curated** historical event database
(~30-50 events) and **coarse curated exposures** for the top 150 tickers, rather than
deriving exposures from 10-K parsing and factor regressions. See `DATA.md`
(written in M7) for the full breakdown of what's real vs hand-curated and what's
known to be approximate.
