import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getDb, schema } from "@macroscope/db";
import { and, eq } from "drizzle-orm";
import { ScenarioRunner } from "./scenario-runner";

export const dynamic = "force-dynamic";

export default async function RunScenarioPage({ params }: { params: { id: string } }) {
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

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-1">
          <Link href={`/portfolios/${portfolio.id}`} className="text-xs text-muted-foreground hover:underline">
            ← back to portfolio
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Run scenario</h1>
          <p className="text-sm text-muted-foreground">
            Describe a macro scenario in plain English. The agent will classify it, retrieve historical
            analogs, and compute position-level impact estimates.{" "}
            <strong>This is not a forecast — it is a historical-analog estimate with explicit ranges.</strong>
          </p>
        </header>

        <ScenarioRunner
          portfolio={{ id: portfolio.id, name: portfolio.name }}
          positions={positions.map((p) => ({
            ticker: p.ticker,
            weight: Number(p.weight),
          }))}
        />
      </div>
    </main>
  );
}
