# Demo script

A 2-minute walkthrough for video or live presentation. The hard rule:
**never claim the system predicts markets**.

---

## 0:00–0:20 — The problem

> "Most macro impact tools either predict numbers they can't justify, or
> just summarize news. Neither is useful for an investor who actually owns
> something. So I built **macroscope** — a portfolio-aware agent that
> answers 'what did markets do in similar situations?', not 'what will
> happen?'."

Open the home page. Read the tagline.

## 0:20–0:40 — Pick a portfolio

Click "Sign in", use the dev-credential email path. Land on the dashboard.
Click "New portfolio" → pick the **Tech Heavy** preset. Land on the
portfolio page; live prices stream in next to each ticker.

> "Top 10 tech names, weighted. Live prices. Now let's run a scenario."

## 0:40–1:30 — The streaming agent

Click "Run scenario →". Pick the chip:

> *"Hyperscaler AI capex slows sharply as cheap reasoning models commoditize compute"*

Click run. While it streams:

> "The agent calls six tools, each visible as a card. First it classifies
> the scenario into tags — `ai_capex_shock`, `tech_correction`. Then it
> finds historical analogs in the curated database — DeepSeek-Jan-2025 is
> the obvious one. Then it pulls per-ticker reactions for our 10 positions
> at the 5-day horizon. Then it aggregates: median, p25, p75 per position
> and a portfolio-level estimate."

Final briefing renders.

> "Notice the citations — every claim has an `[event_id]` chip. Hover one
> and you see the underlying event. The portfolio summary is framed as a
> historical-analog estimate, not a prediction. NVDA is the largest
> contributor by weight × median move. Caveats list any positions with
> insufficient analog coverage."

## 1:30–2:00 — Why this is defensible

> "The interesting engineering: six deterministic tools, individually
> unit-tested, run end-to-end **without any LLM in the loop**. The full
> pipeline can produce a structured impact report from rule-based
> classification alone. The LLM only does what LLMs are actually good at:
> deciding which tool to call next and writing prose. There's an eval
> harness with 16 scenarios that runs before any prompt change. Every job
> records token usage and cache hits, so cost is observable.
>
> Total cost per run at list price: well under $0.50. Total scope: small
> enough to defend in a 45-minute interview."

End on the dashboard with the briefing visible.

---

## Recording tips

- Run `pnpm db:reactions` ahead of time so the demo isn't bottlenecked
  on Yahoo fetches.
- Pre-warm the Anthropic prompt cache: kick off one dummy scenario with
  the Tech Heavy preset before recording. Iteration 2+ is noticeably faster.
- Hide your dev tools / OAuth secrets if the camera ever sees them.
- Use a 1280x720 capture and a paced cursor — viewers can't follow fast
  movements on small UI cards.

## What NOT to say

- "Our model predicts…"
- "We forecast…"
- "Expected return is…"
- "[positive number] dollars of expected outperformance"

What to say instead:
- "Across N analogs, the median move was…"
- "Historical-analog estimate"
- "Range from the 25th to the 75th percentile"
