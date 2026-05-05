# Evals

> The unglamorous milestone that separates serious LLM work from amateur hacking.

## What we're trying to evaluate

Three levels:

1. **Tool-layer correctness** — given identical inputs, the deterministic tool
   layer produces identical outputs. Pure unit tests in
   `packages/tools/src/*.test.ts`.
2. **Agent behavior** — for a fixed scenario + portfolio, does the agent call
   the right tools, classify into the right tags, and produce a coherent
   structured briefing?
3. **Honesty constraint adherence** — does the briefing avoid forecasting
   language and cite every numeric claim?

## What's in `evals/`

- `scenarios.ts` — 16 hand-curated scenarios, each with structured behavioral
  expectations (not exact-string match).
- `run.ts` — runner with two modes:
  - `--baseline` — runs the deterministic pipeline (rule-based classifier +
    tools, no LLM). This is the regression net for the data + tool layer.
    Costs nothing per run.
  - default — runs the full agent loop. Captures every `AgentEvent`, harvests
    classification/analogs/impact from tool results, regex-checks honesty.
- `judge.ts` — separate, optional LLM-judge that re-reads the latest run.json
  and scores each briefing on honesty / citation / coverage_caveats axes 0-3.
- `runs/` — committed report cards (.md + .json). Track drift over time.

## What we check, per scenario

Each scenario in `scenarios.ts` declares any subset of these expectations:

| field | meaning |
|---|---|
| `mustClassifyTags` | classifier must include each |
| `mustNotClassifyTags` | classifier must NOT include any |
| `mustUseAnalogs` | agent must call `find_historical_analogs` |
| `mustReferenceAnalog` | at least one of these event ids must surface |
| `topContributorsInclude` | at least one named ticker must appear in top 3 |
| `portfolioMedianSign` | sign of portfolio median (`+`, `-`, or `any`) |
| `honestyMustHold` | run forecasting-language regex + disclaimer check |

The scenarios cover the breadth of the scenario taxonomy:
- monetary (dovish + hawkish)
- oil supply + demand shocks
- AI capex
- geopolitical (Asia, Europe, Middle East)
- banking
- sovereign debt
- vol events / flash crashes
- pandemic
- trade war
- currency crisis
- recovery rallies
- one negative-control "irrelevant text" scenario

## How to run

```bash
# tool-layer unit tests (cheap, deterministic, no DB needed for most)
pnpm test

# baseline mode — no LLM, no API key required
pnpm eval:baseline

# full agent mode — requires ANTHROPIC_API_KEY + a running DB
pnpm eval

# only one scenario, for debugging
pnpm --filter @macroscope/evals run -- --only oil_supply_shock

# LLM judge over the most recent run
pnpm eval:judge
```

## Honesty regex

Forbidden phrases (regex source):
- `\bwill (fall|drop|rise|rally|crash|surge)\b`
- `\bexpect(?:s|ed|ing)? to (fall|drop|rise|rally|crash|surge)\b`
- `\bpredict(?:s|ed|ing)?\b`
- `\bwe forecast\b`
- `\bour forecast\b`

Required disclaimer (regex):
- `not a prediction|historical[- ]analog|analog estimate`

These are deliberately conservative: a false-positive ("we predict that X will
be..."), if it sneaks in, is preferable to drift toward forecasting framing.

## Process discipline

- Run the eval before any prompt change.
- Commit the resulting report-card alongside the prompt change PR so future
  readers can see the diff in pass/fail and judge whether the change was a
  net win.
- When a scenario starts failing, the first question is: *did the tool give
  the LLM ambiguous input?* (almost always yes). Fix the tool first.
- The LLM-judge is informative, not authoritative. Treat its scores as
  signal-to-investigate, not a verdict.

## Known gaps in the harness

- We don't currently fuzz the rule-based classifier against generated text.
- We don't measure cost-per-run as a hard regression check, but token usage
  is logged in every run report so drift is visible.
- We don't yet seed news_chunks, so `search_news_archive` paths in scenarios
  that exercise it return `[]`.
