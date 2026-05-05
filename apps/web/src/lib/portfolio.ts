import Papa from "papaparse";
import { z } from "zod";

export const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,15}$/;

export const PositionInputSchema = z.object({
  ticker: z.string().trim().toUpperCase().regex(TICKER_RE, "invalid ticker"),
  weight: z.coerce.number().refine((n) => n > 0 && n <= 1.000_001, "weight must be in (0, 1]"),
  shares: z.coerce.number().nonnegative().optional(),
});

export const PortfolioInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  positions: z.array(PositionInputSchema).min(1).max(200),
});

export type PortfolioInput = z.infer<typeof PortfolioInputSchema>;
export type PositionInput = z.infer<typeof PositionInputSchema>;

export interface ParsedRow {
  ticker: string;
  weight: number;
  shares?: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  warnings: string[];
  errors: string[];
}

/**
 * Accepts CSV text with header row containing at minimum a "ticker" column
 * and one of "weight" or "shares". If only "shares" is given, weights are
 * computed as shares/sum(shares). Weights are then re-normalized to 1.0.
 */
export function parsePortfolioCsv(csvText: string): ParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const out: ParsedRow[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0) {
    for (const e of parsed.errors) errors.push(`row ${e.row}: ${e.message}`);
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    errors.push("no data rows found");
    return { rows: out, warnings, errors };
  }

  const headers = parsed.meta.fields ?? [];
  if (!headers.includes("ticker")) {
    errors.push("missing required column: ticker");
    return { rows: out, warnings, errors };
  }
  const hasWeight = headers.includes("weight");
  const hasShares = headers.includes("shares");
  if (!hasWeight && !hasShares) {
    errors.push("must include either 'weight' or 'shares' column");
    return { rows: out, warnings, errors };
  }

  for (const [i, raw] of rows.entries()) {
    const ticker = (raw.ticker ?? "").trim().toUpperCase();
    if (!ticker) {
      warnings.push(`row ${i + 2}: empty ticker, skipped`);
      continue;
    }
    if (!TICKER_RE.test(ticker)) {
      warnings.push(`row ${i + 2}: ticker "${ticker}" looks invalid, skipped`);
      continue;
    }
    const w = hasWeight ? Number(raw.weight) : NaN;
    const s = hasShares ? Number(raw.shares) : NaN;
    out.push({
      ticker,
      weight: Number.isFinite(w) ? w : 0,
      shares: Number.isFinite(s) ? s : undefined,
    });
  }

  if (out.length === 0) {
    errors.push("no valid rows after parsing");
    return { rows: out, warnings, errors };
  }

  // If weights are missing/zero but shares are present, derive weights from shares.
  const weightSum = out.reduce((a, r) => a + r.weight, 0);
  if (weightSum <= 0 && hasShares) {
    const sharesSum = out.reduce((a, r) => a + (r.shares ?? 0), 0);
    if (sharesSum > 0) {
      for (const r of out) r.weight = (r.shares ?? 0) / sharesSum;
      warnings.push("derived weights from shares column");
    }
  }

  // Normalize weights to sum to 1.0 (with a small tolerance).
  const finalSum = out.reduce((a, r) => a + r.weight, 0);
  if (finalSum <= 0) {
    errors.push("all weights are zero — cannot normalize");
    return { rows: out, warnings, errors };
  }
  if (Math.abs(finalSum - 1) > 0.0001) {
    warnings.push(`weights summed to ${finalSum.toFixed(4)}; normalized to 1.0`);
    for (const r of out) r.weight = r.weight / finalSum;
  }

  return { rows: out, warnings, errors };
}
