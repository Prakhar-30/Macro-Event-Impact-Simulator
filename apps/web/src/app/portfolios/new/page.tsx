import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { PRESETS } from "@/lib/presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NewPortfolioForm } from "./new-portfolio-form";

export default async function NewPortfolioPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-1">
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">
            ← back to dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">New portfolio</h1>
          <p className="text-sm text-muted-foreground">
            Upload a CSV with columns <code>ticker</code> and <code>weight</code> (or{" "}
            <code>shares</code>), or start from a preset.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>From CSV or pasted tickers</CardTitle>
            <CardDescription>
              Weights don't have to sum to 1 — they'll be normalized automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewPortfolioForm presets={PRESETS} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Or jump straight from a preset</CardTitle>
            <CardDescription>One click — no CSV.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {PRESETS.map((p) => (
              <form
                key={p.id}
                action={`/api/portfolios/preset/${p.id}`}
                method="post"
                className="block"
              >
                <Button type="submit" variant="outline" className="h-auto w-full justify-start whitespace-normal text-left">
                  <span>
                    <span className="font-medium">{p.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{p.description}</span>
                  </span>
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
