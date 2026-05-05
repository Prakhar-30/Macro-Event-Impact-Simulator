/**
 * Job processor: runs the agent loop for one scenario job, publishes every
 * AgentEvent to a Redis pub/sub channel keyed by jobId, persists job_events
 * to Postgres for replay, and updates the jobs row when done.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@macroscope/db";
import { runAgent, type AgentEvent } from "@macroscope/agent";
import { getPublisher, jobChannel, type ScenarioJob } from "./queue.js";

export async function processScenario(job: ScenarioJob) {
  const { jobId, portfolioId, scenario } = job.data;
  const db = getDb();
  const pub = getPublisher();
  let seq = 0;

  await db
    .update(schema.jobs)
    .set({ status: "running" })
    .where(eq(schema.jobs.id, jobId));

  // Pre-fetch portfolio context so we can cache it in the prompt.
  const positions = await db
    .select({
      ticker: schema.positions.ticker,
      weight: schema.positions.weight,
    })
    .from(schema.positions)
    .where(eq(schema.positions.portfolioId, portfolioId));

  const portfolioContext = {
    tickersWithWeights: positions.map((p) => ({
      ticker: p.ticker,
      weight: Number(p.weight),
    })),
  };

  const onEvent = async (e: AgentEvent) => {
    seq += 1;
    const payload = JSON.stringify({ seq, ...e });
    await pub.publish(jobChannel(jobId), payload);
    await db.insert(schema.jobEvents).values({
      jobId,
      seq,
      kind: e.kind,
      payload: e as object,
    });
  };

  try {
    const result = await runAgent({
      scenario,
      portfolioId,
      portfolioContext,
      onEvent,
    });

    await db
      .update(schema.jobs)
      .set({
        status: "succeeded",
        result: { finalText: result.finalText },
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheWriteTokens: result.usage.cacheWriteTokens,
        finishedAt: new Date(),
      })
      .where(eq(schema.jobs.id, jobId));
    return result;
  } catch (e) {
    const message = (e as Error).message;
    await db
      .update(schema.jobs)
      .set({ status: "failed", errorMessage: message, finishedAt: new Date() })
      .where(eq(schema.jobs.id, jobId));
    await onEvent({ kind: "agent_error", message });
    throw e;
  }
}
