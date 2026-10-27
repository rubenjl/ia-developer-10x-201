import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from './config.js';

export type EmailJob =
  | { type: 'order-confirmed'; orderId: string }
  | { type: 'ticket-access'; tenantId: string; to: string; code: string; url: string }
  | { type: 'test-email'; tenantId: string; to: string };

let queue: Queue | null = null;

export function emailQueue(): Queue {
  if (!queue) {
    const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue('emails', { connection });
  }
  return queue;
}

export async function enqueueEmail(job: EmailJob): Promise<string | undefined> {
  const added = await emailQueue().add(job.type, job, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
  });
  return added.id;
}
