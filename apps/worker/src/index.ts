import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { makeWorker } from "./queue.js";
import { processScenario } from "./process-scenario.js";
import { sseRoutes } from "./sse.js";

const app = new Hono();

app.get("/healthz", (c) =>
  c.json({
    ok: true,
    worker: "macroscope-worker",
    ts: new Date().toISOString(),
  })
);

app.route("/", sseRoutes);

const port = Number(process.env.WORKER_PORT ?? 4000);

const bullWorker = makeWorker(async (job) => {
  console.log(`[worker] processing job ${job.id}`);
  return await processScenario(job);
});
bullWorker.on("completed", (job) => console.log(`[worker] completed ${job.id}`));
bullWorker.on("failed", (job, err) =>
  console.warn(`[worker] failed ${job?.id ?? "?"}: ${err.message}`)
);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[worker] listening on http://localhost:${info.port}`);
});

const shutdown = async () => {
  console.log("[worker] shutting down");
  try { await bullWorker.close(); } catch { /* noop */ }
  server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
