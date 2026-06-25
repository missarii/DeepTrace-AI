/** BullMQ worker: durable research jobs → invokes Python agent service, persists events, handles cancel/retry. */
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const AGENT = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000';
const TOKEN = process.env.AGENT_SERVICE_TOKEN ?? 'change-me-internal-token';

async function emit(runId: string, type: string, payload: Record<string, unknown> = {}) {
  const last = await prisma.agentEvent.findFirst({ where: { runId }, orderBy: { seq: 'desc' } });
  await prisma.agentEvent.create({ data: { runId, seq: (last?.seq ?? 0) + 1, type, payload } });
}

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });

export const worker = new Worker('research', async (job) => {
  const { runId, ownerId } = job.data as { runId: string; ownerId: string };
  const run = await prisma.researchRun.findUnique({ where: { id: runId } });
  if (!run || run.ownerId !== ownerId) throw new Error('ownership mismatch');
  if (run.status === 'cancelled') return { skipped: 'cancelled' };
  await prisma.researchRun.update({ where: { id: runId }, data: { status: 'running', startedAt: new Date() } });
  await emit(runId, 'research.started', { jobId: job.id });
  // Stream agent progress: agent returns SSE; worker mirrors key events into DB.
  const res = await fetch(`${AGENT}/v1/runs/${runId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ question: run.question, depth: run.depth, objectives: run.objectives, config: run.config, ownerId, projectId: run.projectId }),
  });
  if (!res.ok || !res.body) {
    await prisma.researchRun.update({ where: { id: runId }, data: { status: 'failed', finishedAt: new Date() } });
    await emit(runId, 'research.failed', { error: `agent returned ${res.status}` });
    throw new Error(`agent service error: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const persist = async (evt: { type: string; payload?: Record<string, unknown>; data?: unknown }) => {
    const current = await prisma.researchRun.findUnique({ where: { id: runId } });
    if (current?.status === 'cancelled') { reader.cancel(); throw new Error('cancelled by user'); }
    await job.updateProgress({ type: evt.type });
    if (evt.type?.startsWith('research.') || evt.type?.includes('.')) {
      try { await emit(runId, evt.type, (evt.payload ?? evt.data ?? {}) as Record<string, unknown>); } catch { /* keep streaming */ }
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() ?? '';
    for (const f of frames) {
      const line = f.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      try { await persist(JSON.parse(line.slice(5).trim())); } catch { /* partial frame */ }
    }
  }
  // Agent persists artifacts via callback; worker marks completion when report exists.
  const report = await prisma.researchReport.findUnique({ where: { runId } });
  await prisma.researchRun.update({ where: { id: runId }, data: { status: report ? 'completed' : 'failed', finishedAt: new Date() } });
  return { ok: true };
}, { connection });

worker.on('failed', async (job, err) => {
  if (!job) return;
  const runId = (job.data as { runId: string }).runId;
  const cur = await prisma.researchRun.findUnique({ where: { id: runId } });
  if (cur && !['completed', 'cancelled'].includes(cur.status)) {
    await prisma.researchRun.update({ where: { id: runId }, data: { status: 'failed', finishedAt: new Date() } });
    await emit(runId, 'research.failed', { error: String(err?.message ?? err).slice(0, 500) });
  }
});

// eslint-disable-next-line no-console
console.log(JSON.stringify({ msg: 'worker_listening', queue: 'research' }));
