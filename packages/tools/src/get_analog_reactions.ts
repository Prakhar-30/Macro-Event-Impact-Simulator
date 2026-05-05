/**
 * get_analog_reactions(eventIds, tickers, horizon) -> AnalogReaction[]
 *
 * Pure SQL fetch from event_reactions. The agent passes the tickers from
 * the portfolio + a chosen horizon ("1d" | "5d" | "30d"); we return one row
 * per (event, ticker) pair that has a reaction recorded.
 *
 * If a ticker has no reaction for an event (e.g. the ticker did not exist
 * yet in 2008), it is silently omitted — the caller (compute_position_impact)
 * is responsible for surfacing positions with low coverage.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@macroscope/db";
import type { AnalogReaction, Horizon } from "./types.js";

export async function getAnalogReactions(
  eventIds: string[],
  tickers: string[],
  horizon: Horizon
): Promise<AnalogReaction[]> {
  if (eventIds.length === 0 || tickers.length === 0) return [];

  const db = getDb();
  const rows = await db
    .select({
      eventId: schema.eventReactions.eventId,
      ticker: schema.eventReactions.ticker,
      horizon: schema.eventReactions.horizon,
      pctReturn: schema.eventReactions.pctReturn,
    })
    .from(schema.eventReactions)
    .where(
      and(
        inArray(schema.eventReactions.eventId, eventIds),
        inArray(schema.eventReactions.ticker, tickers),
        eq(schema.eventReactions.horizon, horizon)
      )
    );

  return rows.map((r) => ({
    eventId: r.eventId,
    ticker: r.ticker,
    horizon: r.horizon as Horizon,
    pctReturn: Number(r.pctReturn),
  }));
}
