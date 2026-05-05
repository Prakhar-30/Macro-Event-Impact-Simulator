import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth, signOut } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  return (
    <main className="container py-16">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">macroscope</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Macro scenario impact simulator for equity portfolios.
          </h1>
          <p className="text-lg text-muted-foreground">
            Describe a macro scenario in plain English. Get a portfolio-level impact estimate,
            anchored in <em>historical analog events</em> — not a forecast.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card title="Curated analogs" body="A small, hand-picked database of past macro events with scenario tags." />
          <Card title="Tool-grounded agent" body="Six deterministic tools do the math; the LLM only orchestrates and writes." />
          <Card title="Cited briefings" body="Every claim links back to an event row or a per-ticker reaction." />
        </section>

        <section className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Button asChild>
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="ghost" type="submit">Sign out ({session.user.email})</Button>
              </form>
            </>
          ) : (
            <Button asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </section>

        <footer className="pt-8 text-xs text-muted-foreground">
          This is a portfolio-grade demo. It does not predict markets. All estimates are
          historical-analog medians with explicit ranges.
        </footer>
      </div>
    </main>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
