import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, schema } from "@macroscope/db";
import { PRESETS } from "@/lib/presets";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.redirect(new URL("/sign-in", _.url));

  const preset = PRESETS.find((p) => p.id === params.id);
  if (!preset) return NextResponse.json({ error: "unknown_preset" }, { status: 404 });

  const db = getDb();
  const portfolio = await db.transaction(async (tx) => {
    const [pf] = await tx
      .insert(schema.portfolios)
      .values({ userId, name: preset.name, description: preset.description })
      .returning();
    if (!pf) throw new Error("insert failed");
    await tx.insert(schema.positions).values(
      preset.positions.map((p) => ({
        portfolioId: pf.id,
        ticker: p.ticker,
        weight: p.weight.toString(),
      }))
    );
    return pf;
  });

  return NextResponse.redirect(new URL(`/portfolios/${portfolio.id}`, _.url));
}
