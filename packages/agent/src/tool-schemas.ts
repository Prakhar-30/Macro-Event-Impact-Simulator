// JSON schemas for the Anthropic tool-use API. Each schema mirrors the
// TypeScript signature of the corresponding tool in @macroscope/tools.

import type Anthropic from "@anthropic-ai/sdk";

const SCENARIO_TAG_ENUM = [
  "rate_shock_dovish","rate_shock_hawkish","monetary_emergency",
  "inflation_shock_up","inflation_shock_down","risk_off","risk_on_relief",
  "growth_scare","recovery_optimism","oil_supply_shock","oil_demand_shock",
  "commodity_spike","commodity_collapse","geopolitical_europe","geopolitical_asia",
  "geopolitical_middle_east","geopolitical_americas","trade_war","trade_deescalation",
  "banking_stress","sovereign_debt","currency_crisis","em_stress","flash_crash",
  "vol_event","tech_correction","ai_capex_shock","pandemic","natural_disaster",
  "us_election_surprise","us_fiscal_crisis"
];

export const TOOL_DEFINITIONS: Anthropic.Messages.Tool[] = [
  {
    name: "classify_scenario",
    description:
      "Parse a user's plain-English scenario into the canonical set of scenario tags. Returns a list of tags, a confidence score, and a rationale. Call this once at the start.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "the user's scenario text" },
      },
      required: ["text"],
    },
  },
  {
    name: "get_portfolio_exposures",
    description:
      "Return the portfolio's exposure summary by GICS sector, by country of HQ, and by thematic tag (e.g. ai_infrastructure, defense_contractor, china_revenue_heavy). Tickers not in the curated universe contribute to an _unmapped bucket — surface those gaps.",
    input_schema: {
      type: "object",
      properties: {
        portfolio_id: { type: "string", description: "uuid of the portfolio" },
      },
      required: ["portfolio_id"],
    },
  },
  {
    name: "find_historical_analogs",
    description:
      "Find curated historical events that share scenario tags with the input. Returns up to `limit` analogs sorted by tag overlap, severity, and a small recency bonus.",
    input_schema: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string", enum: SCENARIO_TAG_ENUM },
          description: "scenario tags to match against the curated event database",
        },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
      },
      required: ["tags"],
    },
  },
  {
    name: "get_analog_reactions",
    description:
      "Fetch per-ticker, per-horizon returns recorded for a set of analog events. Returns one row per (event, ticker) pair that has a reaction at the chosen horizon. Tickers without coverage for a given event are silently omitted — caller is responsible for surfacing coverage gaps.",
    input_schema: {
      type: "object",
      properties: {
        event_ids: { type: "array", items: { type: "string" }, minItems: 1 },
        tickers: { type: "array", items: { type: "string" }, minItems: 1 },
        horizon: { type: "string", enum: ["1d", "5d", "30d"] },
      },
      required: ["event_ids", "tickers", "horizon"],
    },
  },
  {
    name: "compute_position_impact",
    description:
      "Aggregate analog reactions into a per-position median, p25, p75 and a portfolio-level summary at the chosen horizon. Pure: same input always yields same output. Surfaces positions with no coverage.",
    input_schema: {
      type: "object",
      properties: {
        positions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ticker: { type: "string" },
              weight: { type: "number" },
            },
            required: ["ticker", "weight"],
          },
        },
        horizon: { type: "string", enum: ["1d", "5d", "30d"] },
        event_ids: { type: "array", items: { type: "string" } },
      },
      required: ["positions", "horizon", "event_ids"],
    },
  },
  {
    name: "search_news_archive",
    description:
      "Optional. Returns short headline snippets from the curated news archive — for narrative color in the briefing only, NEVER for impact calculation. May return [] if the archive isn't populated yet.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "natural language query" },
        event_id: { type: "string", description: "optionally narrow to one event" },
        top_k: { type: "integer", minimum: 1, maximum: 10, default: 5 },
      },
      required: ["query"],
    },
  },
];
