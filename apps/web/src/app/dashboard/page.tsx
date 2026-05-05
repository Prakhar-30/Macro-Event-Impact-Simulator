import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { getDb, schema } from "@macroscope/db";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/sign-in");

  const db = getDb();
  const portfolios = await db
    .select()
    .from(schema.portfolios)
    .where(eq(schema.portfolios.userId, userId))
    .orderBy(desc(schema.portfolios.updatedAt));

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">dashboard</p>
            <h1 className="text-2xl font-semibold tracking-tight">Your portfolios</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link href="/portfolios/new">New portfolio</Link>
            </Button>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="ghost">Sign out</Button>
            </form>
          </div>
        </header>

        {portfolios.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No portfolios yet</CardTitle>
              <CardDescription>
                Upload a CSV (ticker,weight) or pick a preset to get started. The agent runs once
                you have a portfolio plus a scenario.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/portfolios/new">Create your first portfolio</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {portfolios.map((p) => (
              <li key={p.id}>
                <Link href={`/portfolios/${p.id}`} className="block">
                  <Card className="transition-colors hover:bg-accent/30">
                    <CardHeader>
                      <CardTitle>{p.name}</CardTitle>
                      <CardDescription>
                        {p.description ?? "No description."}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
