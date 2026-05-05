/**
 * get_portfolio_exposures(portfolioId) -> { bySector, byCountryHq, byThematic, ... }
 *
 * Joins position weights with the curated `tickers` table. Tickers not in
 * the curated universe contribute to a synthetic "_unmapped" bucket so the
 * agent knows about coverage gaps.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@macroscope/db";
import type { PortfolioExposureSummary } from "./types.js";

export async function getPortfolioExposures(portfolioId: string): Promise<PortfolioExposureSummary> {
  const db = getDb();

  const positions = await db
    .select({
      ticker: schema.positions.ticker,
      weight: schema.positions.weight,
    })
    .from(schema.positions)
    .where(eq(schema.positions.portfolioId, portfolioId));

  const symbols = positions.map((p) => p.ticker);
  if (symbols.length === 0) {
    return {
      bySector: {},
      byCountryHq: {},
      byThematic: {},
      positionCount: 0,
      totalWeight: 0,
    };
  }

  const tickerRows = symbols.length
    ? await db.query.tickers.findMany({
        where: (t, { inArray }) => inArray(t.symbol, symbols),
      })
    : [];
  const meta = new Map(tickerRows.map((r) => [r.symbol, r]));

  const bySector: Record<string, number> = {};
  const byCountryHq: Record<string, number> = {};
  const byThematic: Record<string, number> = {};
  let total = 0;

  for (const pos of positions) {
    const w = Number(pos.weight);
    total += w;

    const m = meta.get(pos.ticker);
    if (!m) {
      bySector["_unmapped"] = (bySector["_unmapped"] ?? 0) + w;
      byCountryHq["_unmapped"] = (byCountryHq["_unmapped"] ?? 0) + w;
      byThematic["_unmapped"] = (byThematic["_unmapped"] ?? 0) + w;
      continue;
    }

    if (m.gicsSector) bySector[m.gicsSector] = (bySector[m.gicsSector] ?? 0) + w;
    if (m.countryHq) byCountryHq[m.countryHq] = (byCountryHq[m.countryHq] ?? 0) + w;
    for (const tag of m.thematicTags ?? []) {
      byThematic[tag] = (byThematic[tag] ?? 0) + w;
    }
  }

  return {
    bySector,
    byCountryHq,
    byThematic,
    positionCount: positions.length,
    totalWeight: total,
  };
}
