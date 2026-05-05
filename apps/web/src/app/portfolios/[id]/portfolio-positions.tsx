"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, formatCurrency } from "@/lib/utils";

interface Position {
  id: string;
  ticker: string;
  weight: number;
  shares: number | null;
}

interface Quote {
  ticker: string;
  price: number | null;
  changePct: number | null;
  currency: string | null;
  marketState: string | null;
  shortName: string | null;
  asOf: string;
}

export function PortfolioPositions({
  positions,
  tickers,
}: {
  positions: Position[];
  tickers: string[];
}) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loadingPrices, setLoadingPrices] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (tickers.length === 0) {
        setLoadingPrices(false);
        return;
      }
      const res = await fetch(`/api/prices?tickers=${tickers.join(",")}`);
      if (!res.ok) {
        setLoadingPrices(false);
        return;
      }
      const json = (await res.json()) as { quotes: Quote[] };
      if (cancelled) return;
      const map: Record<string, Quote> = {};
      for (const q of json.quotes) map[q.ticker] = q;
      setQuotes(map);
      setLoadingPrices(false);
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tickers]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Positions ({positions.length})</span>
          <span className="text-xs font-normal text-muted-foreground">
            {loadingPrices ? "loading prices…" : "delayed quotes via yahoo-finance2"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Weight</th>
                <th className="px-3 py-2 text-right">Last</th>
                <th className="px-3 py-2 text-right">Day Δ</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const q = quotes[p.ticker];
                const change = q?.changePct;
                return (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono">{p.ticker}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {q?.shortName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPercent(p.weight, 2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {q?.price != null
                        ? formatCurrency(q.price, q.currency ?? "USD")
                        : "—"}
                    </td>
                    <td
                      className={
                        "px-3 py-2 text-right tabular-nums " +
                        (change == null
                          ? "text-muted-foreground"
                          : change >= 0
                            ? "text-emerald-500"
                            : "text-red-500")
                      }
                    >
                      {change == null ? "—" : `${change >= 0 ? "+" : ""}${(change * 100).toFixed(2)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
