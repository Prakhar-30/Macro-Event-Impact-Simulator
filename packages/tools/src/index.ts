// Deterministic tool layer (M3).
// Each tool is independently unit-tested. Together they form the full
// scenario-impact pipeline; the agent in @macroscope/agent simply
// orchestrates calls to these via the Anthropic Messages tool-use API.

export { classifyScenarioRulebased } from "./classify_scenario.js";
export { getPortfolioExposures } from "./portfolio_exposures.js";
export { findHistoricalAnalogs } from "./find_historical_analogs.js";
export { getAnalogReactions } from "./get_analog_reactions.js";
export { computePositionImpact } from "./compute_position_impact.js";
export { searchNewsArchive } from "./search_news_archive.js";
export { median, quantile } from "./stats.js";
export * from "./types.js";

import { classifyScenarioRulebased } from "./classify_scenario.js";
import { findHistoricalAnalogs } from "./find_historical_analogs.js";
import { getAnalogReactions } from "./get_analog_reactions.js";
import { computePositionImpact } from "./compute_position_impact.js";
import type {
  AnalogEvent,
  ClassificationResult,
  Horizon,
  PortfolioImpactSummary,
  PortfolioPosition,
} from "./types.js";

/**
 * runDeterministicPipeline — the M3 "no LLM in the loop" baseline.
 *
 * Lets the agent (and the eval harness) run the full scenario flow with
 * the rule-based classifier. Useful as a sanity baseline to compare against
 * the LLM-driven path in M4 — and as the safety net if the LLM is offline.
 */
export interface DeterministicRunInput {
  scenario: string;
  positions: PortfolioPosition[];
  horizon?: Horizon;
  analogLimit?: number;
}

export interface DeterministicRunOutput {
  classification: ClassificationResult;
  analogs: AnalogEvent[];
  impact: PortfolioImpactSummary;
}

export async function runDeterministicPipeline(
  input: DeterministicRunInput
): Promise<DeterministicRunOutput> {
  const horizon = input.horizon ?? "5d";
  const classification = classifyScenarioRulebased(input.scenario);
  const analogs = await findHistoricalAnalogs(classification.tags, input.analogLimit ?? 8);
  const reactions = await getAnalogReactions(
    analogs.map((e) => e.id),
    input.positions.map((p) => p.ticker),
    horizon
  );
  const impact = computePositionImpact(input.positions, reactions, horizon);
  return { classification, analogs, impact };
}
