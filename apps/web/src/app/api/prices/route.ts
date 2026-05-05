import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tickers = (url.searchParams.get("tickers") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tickers.length === 0) return NextResponse.json({ quotes: [] });
  if (tickers.length > 100) {
    return NextResponse.json({ error: "too_many_tickers" }, { status: 400 });
  }

  const quotes = await getQuotes(tickers);
  return NextResponse.json({ quotes });
}
