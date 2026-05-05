import yahooFinance from "yahoo-finance2";

// yahoo-finance2 logs a "survey" notice on first call; silence it for cleaner CLI output.
yahooFinance.suppressNotices(["yahooSurvey"]);

export interface PriceQuote {
  ticker: string;
  price: number | null;
  changePct: number | null;
  currency: string | null;
  marketState: string | null;
  shortName: string | null;
  asOf: string;
}

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; q: PriceQuote }>();

export async function getQuotes(tickers: string[]): Promise<PriceQuote[]> {
  const unique = Array.from(new Set(tickers.map((t) => t.toUpperCase()))).filter(Boolean);
  if (unique.length === 0) return [];

  const now = Date.now();
  const fresh: PriceQuote[] = [];
  const stale: string[] = [];
  for (const t of unique) {
    const c = cache.get(t);
    if (c && now - c.at < CACHE_MS) fresh.push(c.q);
    else stale.push(t);
  }

  if (stale.length > 0) {
    try {
      const result = await yahooFinance.quote(stale, {}, { validateResult: false });
      const arr = Array.isArray(result) ? result : [result];
      for (const r of arr) {
        const q: PriceQuote = {
          ticker: (r.symbol ?? "").toUpperCase(),
          price: typeof r.regularMarketPrice === "number" ? r.regularMarketPrice : null,
          changePct:
            typeof r.regularMarketChangePercent === "number" ? r.regularMarketChangePercent / 100 : null,
          currency: r.currency ?? null,
          marketState: r.marketState ?? null,
          shortName: r.shortName ?? r.longName ?? null,
          asOf: new Date().toISOString(),
        };
        cache.set(q.ticker, { at: now, q });
        fresh.push(q);
      }
      // Anything still missing — surface as null quote so the UI can show "—" rather than crash.
      for (const t of stale) {
        if (!fresh.find((f) => f.ticker === t)) {
          fresh.push({
            ticker: t,
            price: null,
            changePct: null,
            currency: null,
            marketState: null,
            shortName: null,
            asOf: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.warn("[prices] yahoo-finance2 quote failed:", (e as Error).message);
      for (const t of stale) {
        fresh.push({
          ticker: t,
          price: null,
          changePct: null,
          currency: null,
          marketState: null,
          shortName: null,
          asOf: new Date().toISOString(),
        });
      }
    }
  }

  // Preserve input order.
  const byTicker = new Map(fresh.map((q) => [q.ticker, q]));
  return unique.map((t) => byTicker.get(t)!).filter(Boolean);
}
