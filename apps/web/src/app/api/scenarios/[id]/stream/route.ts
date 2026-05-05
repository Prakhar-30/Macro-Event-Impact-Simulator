import { auth } from "@/lib/auth";
import { getDb, schema } from "@macroscope/db";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxies the worker's SSE stream for the requested job, after verifying
 * the requesting user owns the underlying portfolio. Keeps the worker
 * unauthenticated on a private network, while still requiring sign-in
 * via Next.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return new Response("unauthorized", { status: 401 });

  const db = getDb();
  const job = await db.query.jobs.findFirst({
    where: and(eq(schema.jobs.id, params.id), eq(schema.jobs.userId, userId)),
  });
  if (!job) return new Response("not_found", { status: 404 });

  const workerBase = process.env.WORKER_PUBLIC_URL ?? "http://localhost:4000";
  const upstream = await fetch(`${workerBase}/jobs/${params.id}/stream`, {
    headers: { accept: "text/event-stream" },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(`upstream ${upstream.status}`, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
