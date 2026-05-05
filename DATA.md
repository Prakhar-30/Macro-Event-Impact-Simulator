# Data

> The single biggest risk in this project is "garbage in, garbage out."
> This document is brutally honest about what is real, what is curated,
> and what is known to be approximate.

## Curated historical events (`seed/events.sql`)

**What it is:** 30 hand-selected macro events from 2008-2025, each tagged with 1-4
scenario tags from the canonical taxonomy in `seed/scenario-tags.md`. Each row
has a stable `id` used as a citation key in the final briefing, plus a severity
score (1-4) and a list of source URLs.

**What it is not:** A comprehensive event database. It is a *small, defensible*
set chosen for clarity and coverage of all 31 scenario tags. There are real
events we deliberately omitted to keep the set small (e.g. 2010 Greek riots,
2018 Argentine peso, 2024 LDP loss). Future work in `scripts/curate.ts` could
expand this to ~100 events without changing the architecture.

**How tags were chosen:** I read the event description and assigned 1-4 tags
that a market participant would have used to characterize it on the day. Some
events are inevitably borderline (e.g. is the August 2015 China devaluation
"currency_crisis" or just "em_stress"? — answer: both). The eval harness
explicitly tests that classifier output overlaps with the tags we ourselves
chose.

## Curated ticker universe (`seed/exposures.json`)

**What it is:** ~154 tickers with GICS sector, GICS industry, country of HQ,
and a list of thematic tags (e.g. `ai_infrastructure`, `bank_regional`,
`china_revenue_heavy`). Includes:
- ~110 large-cap US single names from across 11 GICS sectors
- 11 SPDR sector ETFs (XL*)
- 19 thematic + bond ETFs (SOXX, SMH, ITA, KRE, GDX, GLD, USO, TLT, …)
- A handful of China ADRs (BABA, PDD, JD)

**What it is not:**
- It is *not* derived from 10-K parsing or factor regressions. Sector and
  industry are GICS standard. Thematic tags are my hand-assignment based
  on public knowledge.
- It does *not* include systematic per-ticker country revenue breakdowns.
  We added a `country_revenue` jsonb column for future expansion but it is
  populated only for a handful of names.
- It is biased toward US large caps. International names beyond a few mega-caps
  (TSM, ASML, Linde) are absent.

**Why this matters in the briefing:** When a position is not in the curated
universe, `get_portfolio_exposures` puts it into an `_unmapped` bucket. The
agent's system prompt requires it to surface unmapped positions in the
caveats section.

## Event reactions (`event_reactions` table, populated by `scripts/pull-reactions.ts`)

**What it is:** Per-(event × ticker × horizon) percent return at +1d, +5d, and
+30d after each event date. Pulled via `yahoo-finance2` historical bars.
~30 events × ~150 tickers × 3 horizons ≈ 13,500 rows when fully populated.

**Methodology:** For each event date, we fetch a window from event-10d to
event+60d, find the first trading day on or after the event date as the
"start" anchor, then take the close at index N for the +Nd horizon where N
is in `{1, 5, 30}` *trading days* (since we filtered to bars Yahoo returned,
we are implicitly counting trading days, not calendar days).

**Known limitations:**
- Some tickers did not exist (or were not yet public) at older event dates.
  For those (event, ticker) pairs, no row is written; the tool layer
  surfaces these as `positionsWithoutCoverage`.
- ETFs replaced by ticker reorganizations (e.g. SVB) are not back-filled.
- Adjusted close is used — splits and dividends are reinvested. Cash dividends
  are not separately tracked.
- Yahoo's historical data has occasional fills/holes; we do not interpolate.
- A 30-day return measured 30 trading days *after* a Friday event (e.g.
  Lehman 2008-09-15, Monday) lands roughly mid-October — for explosive
  drawdown events the choice of horizon meaningfully changes the conclusion.
  This is real-world ambiguity, not a bug.

**Cache:** Every Yahoo response is persisted to `data/cache/<TICKER>_<start>_<end>.json`.
Re-runs of the pull script are essentially free; the cache is gitignored.

## News archive (`news_chunks` table — not yet populated)

The schema is in place with a `pgvector(1024)` embedding column.
The ingestion pipeline is M7 future work. When it lands:

- **Sources:** GDELT (CC-licensed event-news aggregation), Wikipedia event
  articles, Federal Reserve / Treasury press releases for relevant dates.
  We deliberately do *not* ingest WSJ/Reuters/FT — those are paywalled and
  not redistributable. The original spec mentioned them; we substituted
  for legal cleanliness.
- **Embedding model:** TBD — ideally a small open model so we don't depend on
  Anthropic for embeddings (the Anthropic API does not currently expose an
  embeddings endpoint).
- **Use:** Narrative color for the "historical context" section of the
  briefing only. Never used for impact calculation.

The system works without this — `search_news_archive` just returns `[]`.

## Live prices

The `/api/prices` endpoint uses `yahoo-finance2` realtime quotes. These are
typically delayed 15 minutes, sometimes more for low-volume symbols. We cache
quotes server-side for 30 seconds to be polite. For the demo, this is plenty.

For a production version we would swap in Polygon, Tiingo, or IEX Cloud — the
prices API is the only place market data is read in M1, so the swap is small.

## Things this project intentionally does not have

- A factor model
- A risk model (no covariance, no betas, no Greeks)
- A backtest framework
- Real-time market data
- Sub-day analysis
- User-uploaded events
- A rebalancing engine

These are not roadmap items — they are out of scope, deliberately. The win
condition is to produce a defensible, honest agentic system grounded in a
small corpus, not to imitate a real risk platform.
