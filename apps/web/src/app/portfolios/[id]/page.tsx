import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb, schema } from "@macroscope/db";
import { and, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PortfolioPositions } from "./portfolio-positions";

export const dynamic = "force-dynamic";

export default async function PortfolioDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/sign-in");

  const db = getDb();
  const portfolio = await db.query.portfolios.findFirst({
    where: and(eq(schema.portfolios.id, params.id), eq(schema.portfolios.userId, userId)),
  });
  if (!portfolio) notFound();

  const positions = await db
    .select()
    .from(schema.positions)
    .where(eq(schema.positions.portfolioId, portfolio.id));

  const tickers = positions.map((p) => p.ticker);

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-1">
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">
            ← back to dashboard
          </Link>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{portfolio.name}</h1>
              {portfolio.description ? (
                <p className="text-sm text-muted-foreground">{portfolio.description}</p>
              ) : null}
            </div>
            <Button asChild>
              <Link href={`/portfolios/${portfolio.id}/run`}>Run scenario →</Link>
            </Button>
          </div>
        </header>

        <PortfolioPositions
          positions={positions.map((p) => ({
            id: p.id,
            ticker: p.ticker,
            weight: Number(p.weight),
            shares: p.shares ? Number(p.shares) : null,
          }))}
          tickers={tickers}
        />
      </div>
    </main>
  );
}
