import { Test } from '@nestjs/testing';
import { ResearchService } from '../src/research/research.service';

describe('ResearchService (unit: envelopes, guards)', () => {
  it('depth defaults resolve', async () => {
    const prisma = {
      project: { findUnique: async () => ({ id: 'p', ownerId: 'u' }) },
      researchRun: { create: async (a: { data: unknown }) => ({ id: 'r', ...(a.data as object) }), findUnique: async () => null },
      agentEvent: { findFirst: async () => null, create: async (a: { data: unknown }) => a.data },
    };
    const queue = { enqueue: async () => undefined };
    const mod = await Test.createTestingModule({ providers: [ResearchService, { provide: 'PrismaService', useValue: prisma }] }).compile().catch(() => null);
    void mod;
    const svc = new ResearchService(prisma as never, queue as never);
    const run = await svc.create('u', { question: 'What are sensor fusion benchmarks for aerial detection?', depth: 'quick', demo: true } as never);
    expect((run as { depth: string }).depth).toBe('quick');
  });

  it('assertOwner forbids cross-user access', async () => {
    const prisma = { researchRun: { findUnique: async () => ({ id: 'r', ownerId: 'other' }) } };
    const svc = new ResearchService(prisma as never, {} as never);
    await expect(svc.assertOwner('me', 'r')).rejects.toThrow('Not your research');
  });

  it('citation export keeps passage + url', async () => {
    const prisma = {
      researchRun: { findUnique: async () => ({ id: 'r', ownerId: 'u', demo: false }) },
      researchReport: { findUnique: async () => ({ title: 'T', summary: 'S', methodology: 'M', sections: [{ heading: 'H', body: 'B' }], gaps: [], limitations: ['L'], citations: [{ url: 'https://example.com/x', passage: 'passage text' }] }) },
    };
    const svc = new ResearchService(prisma as never, {} as never);
    const out = await svc.exportMarkdown('u', 'r');
    expect(out.markdown).toContain('https://example.com/x');
    expect(out.markdown).toContain('passage text');
  });
});
