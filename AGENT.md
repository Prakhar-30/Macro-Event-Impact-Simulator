# Agent design

This document explains *how* the agent is built and *why* — specifically the
prompt design, the tool boundaries, and the deliberate decision to make the
LLM the thin layer rather than the thick one.

## The design rule: tools first, prompt second

When the agent gives a flaky answer, the right reflex is almost always
*"strengthen the tool, not the prompt"*.

A weak tool layer leaks ambiguity into the model's context. The model then
needs heroic prompting to compensate, and even when it works it is not
reproducible. A strong tool layer hands the model a small, structured fact
set and asks it to write a paragraph — a task it is genuinely good at.

Operationally:

- Every tool returns typed, structured JSON. No prose blobs.
- Every tool can be unit-tested without an LLM.
- The eval harness has a `--baseline` mode that runs the full pipeline with
  a rule-based classifier *and no other LLM in the loop*. This is the
  regression net for the deterministic layer.

## Model

Single model: `claude-opus-4-7` (Claude Opus 4.7) for both the classification
prompt and the agent loop.

The original plan had Sonnet 4.5 for the agent and Haiku 4.5 for classification
to be cost-aware. We elected single-model simplicity for the demo because
debugging two models is a tax that doesn't pay off at this scale.

The model id is centralized in `packages/agent/src/model.ts`. Swapping models
is a one-line change.

## Prompt design

`packages/agent/src/prompts.ts` is the single source of truth for all prompt
strings. Two prompts:

### `SYSTEM_PROMPT`
Used by the agent loop. Contains:
1. **Hard constraints** — six rules the model is told never to violate, with
   the honesty constraint at the top.
2. **How to work** — the canonical tool-call sequence.
3. **Output format** — exactly what the final assistant message must contain.

The honesty constraint is encoded both in the system prompt and re-checked
post-hoc by:
- The eval harness (regex for forecasting phrases + presence of disclaimer).
- The optional LLM-judge eval that scores honesty 0-3.

### `CLASSIFIER_SYSTEM_PROMPT`
Standalone prompt used if/when we wire an LLM-based classifier. Currently the
default `dispatchTool` path uses the deterministic rule-based classifier
(`classifyScenarioRulebased`) — the agent gets a fast, reproducible
classification without a second LLM call. If the rule-based path returns
empty tags, the loop has the option to retry with the LLM classifier (M7
follow-up — not yet wired).

## Tool design

Six tools live in `packages/tools/src/`, each in its own file:

### 1. `classify_scenario(text) -> { tags, confidence, rationale }`
Maps free text to the canonical 31-tag set. Pure regex rules + co-occurrence
boosts. Returns `confidence: 0` when nothing matches.

### 2. `get_portfolio_exposures(portfolioId) -> { bySector, byCountryHq, byThematic, ... }`
Joins positions × the curated `tickers` table. Tickers not in the universe
contribute to a synthetic `_unmapped` bucket so the agent can surface coverage
gaps.

### 3. `find_historical_analogs(tags, limit) -> AnalogEvent[]`
Tag-overlap scoring with severity (×0.25) and recency (12-year half-life × 0.05)
bonuses. The recency bonus is small enough that it only breaks ties; severity
is what reliably bubbles up genuine crises.

### 4. `get_analog_reactions(eventIds, tickers, horizon) -> AnalogReaction[]`
Pure SQL: pull the (events × tickers × horizon) slice. Tickers without a
recorded reaction for an event are silently omitted — `compute_position_impact`
is responsible for surfacing the coverage gap.

### 5. `compute_position_impact(positions, reactions, horizon) -> PortfolioImpactSummary`
Pure JS aggregation: per-position median / p25 / p75 from analog reactions,
plus a portfolio-level weighted-median summary. Tested with property-style
unit tests (deterministic in / deterministic out).

### 6. `search_news_archive(query, eventId, topK) -> NewsHit[]`
pgvector cosine search. For narrative context only. May return `[]` when the
news index is empty (the M2 milestone seeded events but not headlines).

## Tool-use loop semantics

The loop in `packages/agent/src/loop.ts` is a small interpreter over the
Anthropic Messages API:

```
while iter < MAX:
    resp = create({ system, tools, messages })
    record usage
    if stop_reason == "tool_use":
        execute every tool_use_block
        append tool_result blocks
        continue
    else:
        emit final text + break
```

Two design choices:
- We **stream every tool call** through a callback (`onEvent`) so the worker
  can publish to Redis pub/sub. The agent loop itself is not async-streaming
  the message body; we use plain `messages.create` and emit an event when
  each block is parsed. This keeps the loop simple and correct.
- We **truncate tool results to 32k chars** before feeding them back in — a
  reasonable safety net for the rare case of a runaway result.

## Prompt caching

The system prompt and the portfolio context block are wrapped with
`cache_control: { type: "ephemeral" }`. For an N-iteration tool-use loop on
one scenario, only iteration 1 pays the full system + context input cost.
Iterations 2..N hit the cache.

`packages/agent/src/loop.ts` records `cache_creation_input_tokens` and
`cache_read_input_tokens` separately so `COSTS.md` can show the per-run
savings empirically.

## The honesty constraint, in code

The constraint is a layered defence:

1. **System prompt** — six explicit rules, with citation requirements.
2. **Output schema** — the system prompt prescribes a structured final message
   with a "caveats" section that must name unmapped positions.
3. **Eval honesty regex** — forbids "will fall / expect / predict / forecast"
   phrases unless paired with explicit "not a prediction" framing.
4. **LLM-judge (optional)** — re-reads the briefing and scores `honesty`,
   `citation`, `coverage_caveats` 0-3.
5. **UI copy** — page header reminds the user this is "a historical-analog
   estimate, not a forecast."

If a layer fails — say, the model slips and writes "expect a 5% drop" — the
regex eval catches it before merge.
