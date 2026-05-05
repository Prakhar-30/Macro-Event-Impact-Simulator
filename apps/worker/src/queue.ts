import { Queue, QueueEvents, Worker, type Job } from "bullmq";
import IORedis, { type Redis } from "ioredis";

export const QUEUE_NAME = "scenario";

let _conn: Redis | null = null;
let _publisher: Redis | null = null;
let _subscriber: Redis | null = null;

function url() {
  const u = process.env.REDIS_URL;
  if (!u) throw new Error("REDIS_URL is not set");
  return u;
}

export function getConnection() {
  if (_conn) return _conn;
  // BullMQ requires maxRetriesPerRequest: null on its connection.
  _conn = new IORedis(url(), { maxRetriesPerRequest: null });
  return _conn;
}

export function getPublisher() {
  if (_publisher) return _publisher;
  _publisher = new IORedis(url());
  return _publisher;
}

export function getSubscriber() {
  if (_subscriber) return _subscriber;
  _subscriber = new IORedis(url());
  return _subscriber;
}

export function jobChannel(jobId: string) {
  return `macroscope:job:${jobId}`;
}

export interface ScenarioJobData {
  jobId: string;
  userId: string | null;
  portfolioId: string;
  scenario: string;
}

export type ScenarioJob = Job<ScenarioJobData>;

export function getQueue() {
  return new Queue<ScenarioJobData>(QUEUE_NAME, { connection: getConnection() });
}

export function makeWorker(processor: (job: ScenarioJob) => Promise<unknown>) {
  return new Worker<ScenarioJobData>(QUEUE_NAME, processor, {
    connection: getConnection(),
    concurrency: 2,
  });
}

export function makeQueueEvents() {
  return new QueueEvents(QUEUE_NAME, { connection: getConnection() });
}
