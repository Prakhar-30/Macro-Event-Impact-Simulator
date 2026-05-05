// Web-side BullMQ producer (only used for enqueueing — the worker
// processes jobs separately).
import { Queue } from "bullmq";
import IORedis from "ioredis";

const QUEUE_NAME = "scenario";

let _queue: Queue | null = null;

export function getScenarioQueue() {
  if (_queue) return _queue;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  const connection = new IORedis(url, { maxRetriesPerRequest: null });
  _queue = new Queue(QUEUE_NAME, { connection });
  return _queue;
}
