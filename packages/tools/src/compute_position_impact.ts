/**
 * compute_position_impact(positions, reactions, horizon) -> PortfolioImpactSummary
 *
 * The single most important deterministic tool: given a portfolio's positions
 * and the analog reactions across N events, computes the per-position median /
 * p25 / p75 reaction at the chosen horizon, and the portfolio-level summary
 * by weight.
 *
 * Pure: no DB, no LLM. Easy to fuzz-test.
 */
import { median, quantile } from "./stats.js";
import type {
  AnalogReaction,
  Horizon,
  PortfolioImpactSummary,
  PortfolioPosition,
  PositionImpact,
} from "./types.js";

export function computePositionImpact(
  positions: PortfolioPosition[],
  reactions: AnalogReaction[],
  horizon: Horizon
): PortfolioImpactSummary {
  const reactionsByTicker = new Map<string, AnalogReaction[]>();
  for (const r of reactions) {
    if (r.horizon !== horizon) continue;
    const arr = reactionsByTicker.get(r.ticker) ?? [];
    arr.push(r);
    reactionsByTicker.set(r.ticker, arr);
  }

  const analogIds = new Set<string>();
  for (const r of reactions) if (r.horizon === horizon) analogIds.add(r.eventId);

  const positionImpacts: PositionImpact[] = [];
  const noCoverage: string[] = [];

  for (const pos of positions) {
    const rs = reactionsByTicker.get(pos.ticker) ?? [];
    if (rs.length === 0) {
      noCoverage.push(pos.ticker);
      continue;
    }
    const returns = rs.map((r) => r.pctReturn);
    const m = median(returns);
    const lo = quantile(returns, 0.25);
    const hi = quantile(returns, 0.75);
    positionImpacts.push({
      ticker: pos.ticker,
      weight: pos.weight,
      horizon,
      analogCount: rs.length,
      median: m,
      p25: lo,
      p75: hi,
      weightedContribution: pos.weight * m,
      source: rs.map((r) => ({ eventId: r.eventId, pctReturn: r.pctReturn })),
    });
  }

  // Portfolio-level: weight-normalized aggregation across covered positions.
  const coveredWeight = positionImpacts.reduce((a, p) => a + p.weight, 0);
  if (coveredWeight === 0) {
    return {
      horizon,
      analogEventIds: [...analogIds],
      positionImpacts: [],
      portfolioMedian: NaN,
      portfolioP25: NaN,
      portfolioP75: NaN,
      positionsWithoutCoverage: noCoverage,
    };
  }

  const wMedian = positionImpacts.reduce((a, p) => a + (p.weight / coveredWeight) * p.median, 0);
  const wP25 = positionImpacts.reduce((a, p) => a + (p.weight / coveredWeight) * p.p25, 0);
  const wP75 = positionImpacts.reduce((a, p) => a + (p.weight / coveredWeight) * p.p75, 0);

  return {
    horizon,
    analogEventIds: [...analogIds],
    positionImpacts: positionImpacts.sort(
      (a, b) => Math.abs(b.weightedContribution) - Math.abs(a.weightedContribution)
    ),
    portfolioMedian: wMedian,
    portfolioP25: wP25,
    portfolioP75: wP75,
    positionsWithoutCoverage: noCoverage,
  };
}
