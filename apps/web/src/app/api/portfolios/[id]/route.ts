import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, schema } from "@macroscope/db";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const portfolio = await db.query.portfolios.findFirst({
    where: and(eq(schema.portfolios.id, params.id), eq(schema.portfolios.userId, userId)),
  });
  if (!portfolio) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const positions = await db
    .select()
    .from(schema.positions)
    .where(eq(schema.positions.portfolioId, portfolio.id));

  return NextResponse.json({ portfolio, positions });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const deleted = await db
    .delete(schema.portfolios)
    .where(and(eq(schema.portfolios.id, params.id), eq(schema.portfolios.userId, userId)))
    .returning({ id: schema.portfolios.id });

  if (deleted.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
