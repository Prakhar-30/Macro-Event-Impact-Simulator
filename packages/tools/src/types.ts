// Shared types for the deterministic tool layer.
// Every tool takes a small typed input and returns a small typed output.
// Same shape used by the Anthropic tool-use schema in M4.

import type { HistoricalEvent } from "@macroscope/db";

export type ScenarioTag =
  | "rate_shock_dovish"
  | "rate_shock_hawkish"
  | "monetary_emergency"
  | "inflation_shock_up"
  | "inflation_shock_down"
  | "risk_off"
  | "risk_on_relief"
  | "growth_scare"
  | "recovery_optimism"
  | "oil_supply_shock"
  | "oil_demand_shock"
  | "commodity_spike"
  | "commodity_collapse"
  | "geopolitical_europe"
  | "geopolitical_asia"
  | "geopolitical_middle_east"
  | "geopolitical_americas"
  | "trade_war"
  | "trade_deescalation"
  | "banking_stress"
  | "sovereign_debt"
  | "currency_crisis"
  | "em_stress"
  | "flash_crash"
  | "vol_event"
  | "tech_correction"
  | "ai_capex_shock"
  | "pandemic"
  | "natural_disaster"
  | "us_election_surprise"
  | "us_fiscal_crisis";

export type ThematicTag =
  | "ai_infrastructure"
  | "ai_demand"
  | "tech_hyperscaler"
  | "tech_software"
  | "semis_designer"
  | "semis_foundry_eq"
  | "defense_contractor"
  | "energy_oil"
  | "energy_pipeline"
  | "energy_renewable"
  | "auto_ev"
  | "auto_legacy"
  | "bank_large"
  | "bank_regional"
  | "reit"
  | "homebuilder"
  | "commodities_metals"
  | "commodities_gold"
  | "staples_defensive"
  | "luxury"
  | "china_revenue_heavy"
  | "europe_revenue_heavy"
  | "em_revenue_heavy"
  | "etf_broad"
  | "etf_sector"
  | "etf_thematic"
  | "etf_bond"
  | "dividend_yielder";

export type Horizon = "1d" | "5d" | "30d";

export interface ClassificationResult {
  tags: ScenarioTag[];
  confidence: number;
  rationale: string;
}

export interface PortfolioPosition {
  ticker: string;
  weight: number;
}

export interface PortfolioExposureSummary {
  bySector: Record<string, number>;
  byCountryHq: Record<string, number>;
  byThematic: Record<string, number>;
  positionCount: number;
  totalWeight: number;
}

export interface AnalogEvent {
  id: string;
  eventDate: string;
  title: string;
  description: string;
  tags: string[];
  severity: number;
  matchedTags: string[];
  matchScore: number;
  sourceUrls: string[];
}

export interface AnalogReaction {
  eventId: string;
  ticker: string;
  horizon: Horizon;
  pctReturn: number;
}

export interface PositionImpact {
  ticker: string;
  weight: number;
  horizon: Horizon;
  analogCount: number;
  median: number;
  p25: number;
  p75: number;
  weightedContribution: number; // weight * median
  source: { eventId: string; pctReturn: number }[];
}

export interface PortfolioImpactSummary {
  horizon: Horizon;
  analogEventIds: string[];
  positionImpacts: PositionImpact[];
  portfolioMedian: number;
  portfolioP25: number;
  portfolioP75: number;
  positionsWithoutCoverage: string[];
}

export interface NewsHit {
  id: string;
  eventId: string | null;
  publishedAt: string | null;
  source: string | null;
  headline: string;
  similarity: number;
}

export interface ToolMeta {
  toolName: string;
  durationMs: number;
}

export type ToolEnvelope<T> = T & { _meta: ToolMeta };

// Re-exports
export type { HistoricalEvent };
