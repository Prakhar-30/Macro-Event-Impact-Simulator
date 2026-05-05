# Costs

How we think about and measure LLM cost on this project.

## Pricing assumptions (2026)

We use Anthropic's published list pricing for `claude-opus-4-7`. Numbers below
should be treated as illustrative — verify against the live pricing page when
you cite this. The exact dollars don't change the conclusions; the *structure*
of where cost lives does.

Typical Opus 4.7 pricing (per 1M tokens):
- input: ~$15
- output: ~$75
- cache write (5-min TTL): ~$18.75 (1.25× input)
- cache read: ~$1.50 (0.1× input)

## What one scenario run costs

A typical scenario run uses 4-7 tool iterations. We measure per-job:

- `inputTokens` — total billable input across all iterations
- `outputTokens` — total output (model's text + tool_use JSON)
- `cacheReadTokens` — input tokens served from cache
- `cacheWriteTokens` — input tokens written to cache

These are persisted in the `jobs` row and re-emitted in every `agent_finish`
event so the eval harness reports them.

### Soft targets (set in `packages/agent/src/model.ts`)
- `inputSoftCap = 20_000` tokens per scenario
- `outputSoftCap = 2_000` tokens per scenario

### Why prompt caching matters here

In a 5-iteration loop, the system prompt + portfolio context (~2k tokens
combined) gets sent on every iteration. Without caching that's `5 × 2_000 =
10_000` redundant input tokens. With caching, iteration 1 pays the full
write cost; iterations 2-5 read from cache at 1/10th the price. Empirical
savings on a 5-iter run:

- without caching: 10k input × $15/M = $0.15 just on the system prompt
- with caching: 2k write + 4×2k read = ~$0.041

So a ~$0.10 saving per run from caching alone — that's ~70% off the static
prompt portion.

## What the demo costs at scale

Treat these as *upper bounds* — a typical run is well under the soft cap.

| Volume | Input ($) | Output ($) | Total ($) |
|---|---|---|---|
| 1 run @ cap | 20k × $15/M = $0.30 | 2k × $75/M = $0.15 | $0.45 |
| 100 runs / day | $30 / day | $15 / day | $45 / day |
| 1k runs / day | $300 / day | $150 / day | $450 / day |

For an interview demo this is essentially free. For real production, you'd
move classification to Haiku 4.5 ($0.80/M in, $4/M out) — that drops the
classifier-call portion by ~95%. The current single-model setup is a
deliberate simplicity tradeoff for the showcase.

## Where else cost hides

- **The LLM-judge eval** is a second LLM pass per scenario. Run it once per
  prompt change, not on every commit.
- **The deterministic eval (`pnpm eval:baseline`)** is free — use it as the
  first line of regression detection.
- **News archive embeddings (M7 future work)** would be a one-time bulk cost
  and then ~free at query time. Keep that pipeline async-able.

## Practical rules of thumb

- If a scenario run looks expensive, look at iterations. >7 iterations almost
  always means the agent is calling tools redundantly — fix the tool result
  shape so it doesn't have to ask twice.
- If output tokens are blowing the cap, the model is being verbose — shorten
  the output spec in the system prompt.
- If input tokens are blowing the cap, a tool result is too big — truncate
  or aggregate at the tool boundary, not in the model.
