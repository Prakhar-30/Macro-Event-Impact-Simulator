/**
 * SSE handler for /jobs/:id/stream.
 *
 * Subscribes a NEW Redis subscriber connection to the job channel and
 * pumps every published event to the client as a `data: <json>` message.
 * Also replays already-persisted job_events on connect so a late-joining
 * client doesn't miss prior tool calls.
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { eq, asc } from "drizzle-orm";
import IORedis from "ioredis";
import { getDb, schema } from "@macroscope/db";
import { jobChannel } from "./queue.js";

export const sseRoutes = new Hono();

sseRoutes.get("/jobs/:id/stream", async (c) => {
  const jobId = c.req.param("id");

  return streamSSE(c, async (stream) => {
    const db = getDb();
    const past = await db
      .select()
      .from(schema.jobEvents)
      .where(eq(schema.jobEvents.jobId, jobId))
      .orderBy(asc(schema.jobEvents.seq));

    let lastSeq = 0;
    for (const ev of past) {
      lastSeq = Math.max(lastSeq, ev.seq);
      await stream.writeSSE({
        event: ev.kind,
        data: JSON.stringify({ seq: ev.seq, ...(ev.payload as object) }),
      });
    }

    // Subscribe to live events.
    const sub = new IORedis(process.env.REDIS_URL ?? "");
    await sub.subscribe(jobChannel(jobId));

    let aborted = false;
    stream.onAbort(async () => {
      aborted = true;
      try { await sub.unsubscribe(jobChannel(jobId)); } catch { /* noop */ }
      await sub.quit().catch(() => undefined);
    });

    sub.on("message", async (_channel, msg) => {
      if (aborted) return;
      try {
        const parsed = JSON.parse(msg) as { seq: number; kind: string };
        if (parsed.seq <= lastSeq) return;
        lastSeq = parsed.seq;
        await stream.writeSSE({ event: parsed.kind, data: msg });
        if (parsed.kind === "agent_finish" || parsed.kind === "agent_error") {
          // Close the stream once the job is done.
          await stream.close();
        }
      } catch (e) {
        console.warn("[sse] bad message", (e as Error).message);
      }
    });

    // Keepalive — send a comment line every 15s so proxies don't drop.
    while (!aborted) {
      await stream.writeSSE({ event: "ping", data: JSON.stringify({ ts: Date.now() }) });
      await stream.sleep(15_000);
    }
  });
});
