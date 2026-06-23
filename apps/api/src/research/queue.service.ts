import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

let queue: Queue | null = null;
function getQueue() {
  if (!queue) {
    const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    queue = new Queue('research', { connection });
  }
  return queue;
}

@Injectable()
export class QueueService {
  async enqueue(runId: string, ownerId: string, demo: boolean) {
    const q = getQueue();
    await q.add('run-research', { runId, ownerId, demo }, { jobId: `research-${runId}`, removeOnComplete: 100, removeOnFail: 200, attempts: 2, backoff: { type: 'exponential', delay: 5000 } });
  }
  async cancel(runId: string) {
    const q = getQueue();
    const job = await q.getJob(`research-${runId}`);
    if (job) { const s = await job.getState(); if (s === 'active' || s === 'waiting' || s === 'delayed') await job.remove().catch(() => undefined); }
  }
}
