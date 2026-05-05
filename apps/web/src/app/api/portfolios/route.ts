import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, schema } from "@macroscope/db";
import { eq, desc } from "drizzle-orm";
import { PortfolioInputSchema } from "@/lib/portfolio";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.portfolios)
    .where(eq(schema.portfolios.userId, userId))
    .orderBy(desc(schema.portfolios.updatedAt));
  return NextResponse.json({ portfolios: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PortfolioInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [pf] = await tx
      .insert(schema.portfolios)
      .values({
        userId,
        name: parsed.data.name,
        description: parsed.data.description,
      })
      .returning();
    if (!pf) throw new Error("insert failed");

    await tx.insert(schema.positions).values(
      parsed.data.positions.map((p) => ({
        portfolioId: pf.id,
        ticker: p.ticker,
        weight: p.weight.toString(),
        shares: p.shares != null ? p.shares.toString() : null,
      }))
    );
    return pf;
  });

  return NextResponse.json({ portfolio: result }, { status: 201 });
}
