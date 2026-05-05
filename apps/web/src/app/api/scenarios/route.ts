import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb, schema } from "@macroscope/db";
import { and, eq } from "drizzle-orm";
import { getScenarioQueue } from "@/lib/queue";

export const runtime = "nodejs";

const Body = z.object({
  portfolioId: z.string().uuid(),
  scenario: z.string().trim().min(8).max(2000),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const portfolio = await db.query.portfolios.findFirst({
    where: and(
      eq(schema.portfolios.id, parsed.data.portfolioId),
      eq(schema.portfolios.userId, userId)
    ),
  });
  if (!portfolio) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [job] = await db
    .insert(schema.jobs)
    .values({
      userId,
      portfolioId: portfolio.id,
      scenarioText: parsed.data.scenario,
      status: "queued",
    })
    .returning();
  if (!job) return NextResponse.json({ error: "insert_failed" }, { status: 500 });

  const queue = getScenarioQueue();
  await queue.add(
    "scenario",
    {
      jobId: job.id,
      userId,
      portfolioId: portfolio.id,
      scenario: parsed.data.scenario,
    },
    { jobId: job.id, removeOnComplete: 1000, removeOnFail: 1000 }
  );

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
