"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parsePortfolioCsv } from "@/lib/portfolio";
import type { Preset } from "@/lib/presets";

export function NewPortfolioForm({ presets }: { presets: Preset[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("My portfolio");
  const [csv, setCsv] = useState(`ticker,weight\nAAPL,0.4\nMSFT,0.3\nNVDA,0.3\n`);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  void presets;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setCsv(text);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarnings([]);

    const parsed = parsePortfolioCsv(csv);
    if (parsed.errors.length > 0) {
      setError(parsed.errors.join("; "));
      return;
    }
    setWarnings(parsed.warnings);

    startTransition(async () => {
      const res = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          positions: parsed.rows.map((r) => ({
            ticker: r.ticker,
            weight: r.weight,
            shares: r.shares,
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `request failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as { portfolio: { id: string } };
      router.push(`/portfolios/${json.portfolio.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Portfolio name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="file">Upload CSV (optional)</Label>
        <Input id="file" type="file" accept=".csv,text/csv" onChange={onFile} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="csv">Or paste rows</Label>
        <textarea
          id="csv"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={10}
          className="w-full rounded-md border bg-transparent p-3 font-mono text-xs"
        />
      </div>

      {error && (
        <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="rounded border bg-muted p-2 text-xs text-muted-foreground">
          {warnings.map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save portfolio"}
      </Button>
    </form>
  );
}
