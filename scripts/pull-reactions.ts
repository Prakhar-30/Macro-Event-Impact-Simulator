/**
 * Pulls historical price data for every (event, ticker) pair in the curated database
 * and writes per-horizon percent returns into event_reactions.
 *
 * Cache strategy: every successful Yahoo response is persisted to data/cache/<TICKER>.json
 * keyed by (start, end). Re-runs read from disk first and only call Yahoo for cache misses.
 *
 * Usage:
 *   pnpm --filter @macroscope/scripts pull-reactions
 *
 * Horizons: +1 trading day, +5 trading days, +30 trading days after the event.
 *   Implementation note: trading-day arithmetic isn't worth approximating — we fetch a
 *   wide window (event_date - 5d ... event_date + 60d) and pick the *N-th business day
 *   after the event* from the actual returned series.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { schema } from "@macroscope/db";
import { sql } from "drizzle-orm";
import yahooFinance from "yahoo-finance2";

yahooFinance.suppressNotices(["yahooSurvey"]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CACHE_DIR = join(REPO_ROOT, "data", "cache");
mkdirSync(CACHE_DIR, { recursive: true });

interface HistoricalRow {
  date: string; // ISO yyyy-mm-dd
  close: number;
  adjClose: number;
}

interface CachedSeries {
  ticker: string;
  start: string;
  end: string;
  rows: HistoricalRow[];
  fetchedAt: string;
}

const HORIZONS = [
  { name: "1d", offsetDays: 1 },
  { name: "5d", offsetDays: 5 },
  { name: "30d", offsetDays: 30 },
] as const;

function cachePath(ticker: string, start: string, end: string) {
  const safe = ticker.replace(/[^A-Z0-9.\-]/gi, "_");
  return join(CACHE_DIR, `${safe}_${start}_${end}.json`);
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchSeries(ticker: string, start: string, end: string): Promise<HistoricalRow[]> {
  const path = cachePath(ticker, start, end);
  if (existsSync(path)) {
    const cached = JSON.parse(readFileSync(path, "utf8")) as CachedSeries;
    return cached.rows;
  }
  try {
    const result = await yahooFinance.historical(ticker, {
      period1: new Date(start + "T00:00:00Z"),
      period2: new Date(end + "T00:00:00Z"),
      interval: "1d",
    });
    const rows: HistoricalRow[] = result.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      close: r.close ?? 0,
      adjClose: r.adjClose ?? r.close ?? 0,
    }));
    const payload: CachedSeries = {
      ticker,
      start,
      end,
      rows,
      fetchedAt: new Date().toISOString(),
    };
    writeFileSync(path, JSON.stringify(payload));
    return rows;
  } catch (e) {
    console.warn(`  [warn] fetch failed for ${ticker} ${start}..${end}: ${(e as Error).message}`);
    return [];
  }
}

interface ReactionInsert {
  eventId: string;
  ticker: string;
  horizon: string;
  pctReturn: number;
  priceStart: number;
  priceEnd: number;
}

function pickReturns(eventDate: string, rows: HistoricalRow[]): ReactionInsert[] | null {
  if (rows.length === 0) return null;
  // Find the first trading day on/after the event date — that's our anchor.
  const eventIdx = rows.findIndex((r) => r.date >= eventDate);
  if (eventIdx < 0 || eventIdx >= rows.length - 1) return null;

  const startRow = rows[eventIdx];
  if (!startRow || startRow.adjClose <= 0) return null;
  const out: ReactionInsert[] = [];

  for (const h of HORIZONS) {
    const j = eventIdx + h.offsetDays;
    if (j >= rows.length) continue;
    const endRow = rows[j];
    if (!endRow || endRow.adjClose <= 0) continue;
    const ret = (endRow.adjClose - startRow.adjClose) / startRow.adjClose;
    out.push({
      eventId: "", // filled by caller
      ticker: "", // filled by caller
      horizon: h.name,
      pctReturn: ret,
      priceStart: startRow.adjClose,
      priceEnd: endRow.adjClose,
    });
  }
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  // 1. Load events.
  const events = await db.select().from(schema.historicalEvents);
  console.log(`[reactions] ${events.length} events`);
  if (events.length === 0) {
    console.error("No events in DB — run db:seed first.");
    await client.end();
    process.exit(1);
  }

  // 2. Load ticker universe.
  const tickers = await db.select({ symbol: schema.tickers.symbol }).from(schema.tickers);
  console.log(`[reactions] ${tickers.length} tickers`);

  // 3. For each event, pull a window ±60d, derive returns at horizons.
  let inserted = 0;
  for (const ev of events) {
    const eventDate = ev.eventDate;
    const start = addDays(eventDate, -10);
    const end = addDays(eventDate, 60);

    console.log(`[reactions] ${ev.id} (${eventDate})`);
    for (const t of tickers) {
      const rows = await fetchSeries(t.symbol, start, end);
      const reactions = pickReturns(eventDate, rows);
      if (!reactions) continue;
      for (const r of reactions) r.eventId = ev.id;
      for (const r of reactions) r.ticker = t.symbol;

      for (const r of reactions) {
        await db
          .insert(schema.eventReactions)
          .values({
            eventId: r.eventId,
            ticker: r.ticker,
            horizon: r.horizon,
            pctReturn: r.pctReturn.toString(),
            priceStart: r.priceStart.toString(),
            priceEnd: r.priceEnd.toString(),
          })
          .onConflictDoUpdate({
            target: [
              schema.eventReactions.eventId,
              schema.eventReactions.ticker,
              schema.eventReactions.horizon,
            ],
            set: {
              pctReturn: r.pctReturn.toString(),
              priceStart: r.priceStart.toString(),
              priceEnd: r.priceEnd.toString(),
              pulledAt: new Date(),
            },
          });
        inserted++;
      }
    }
  }

  const countRows = await client<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM event_reactions
  `;
  console.log(`[reactions] inserted/updated ${inserted}; total in db: ${countRows[0]?.count ?? "0"}`);
  void sql;
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
