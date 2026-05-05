// Preset portfolios so the demo flow works without uploading anything.
export interface Preset {
  id: string;
  name: string;
  description: string;
  positions: { ticker: string; weight: number }[];
}

export const PRESETS: Preset[] = [
  {
    id: "sp500-mini",
    name: "S&P 500 (top 10 weights)",
    description: "Approx. cap-weighted slice of the index using the largest constituents.",
    positions: [
      { ticker: "AAPL", weight: 0.18 },
      { ticker: "MSFT", weight: 0.16 },
      { ticker: "NVDA", weight: 0.16 },
      { ticker: "AMZN", weight: 0.1 },
      { ticker: "META", weight: 0.08 },
      { ticker: "GOOGL", weight: 0.08 },
      { ticker: "GOOG", weight: 0.07 },
      { ticker: "BRK-B", weight: 0.07 },
      { ticker: "TSLA", weight: 0.05 },
      { ticker: "AVGO", weight: 0.05 },
    ],
  },
  {
    id: "tech-heavy",
    name: "Tech Heavy",
    description: "AI / semis / hyperscaler skew. Highly exposed to rates and AI capex.",
    positions: [
      { ticker: "NVDA", weight: 0.2 },
      { ticker: "MSFT", weight: 0.15 },
      { ticker: "GOOGL", weight: 0.1 },
      { ticker: "META", weight: 0.1 },
      { ticker: "AMZN", weight: 0.1 },
      { ticker: "AAPL", weight: 0.1 },
      { ticker: "AVGO", weight: 0.08 },
      { ticker: "AMD", weight: 0.07 },
      { ticker: "ASML", weight: 0.05 },
      { ticker: "TSM", weight: 0.05 },
    ],
  },
  {
    id: "dividend",
    name: "Dividend / Defensive",
    description: "Lower-beta, higher-yield names. Less exposed to AI capex; more rate-sensitive.",
    positions: [
      { ticker: "JNJ", weight: 0.12 },
      { ticker: "PG", weight: 0.12 },
      { ticker: "KO", weight: 0.1 },
      { ticker: "PEP", weight: 0.1 },
      { ticker: "VZ", weight: 0.08 },
      { ticker: "T", weight: 0.08 },
      { ticker: "XOM", weight: 0.1 },
      { ticker: "CVX", weight: 0.1 },
      { ticker: "MCD", weight: 0.1 },
      { ticker: "WMT", weight: 0.1 },
    ],
  },
];
