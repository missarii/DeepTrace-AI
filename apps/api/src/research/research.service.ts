import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { QueueService } from './queue.service';
import { CreateResearchDto } from './dto';

const DEPTH_DEFAULTS = {
  quick: { maxIterations: 1, maxSearches: 6 },
  standard: { maxIterations: 2, maxSearches: 16 },
  comprehensive: { maxIterations: 3, maxSearches: 24 },
} as const;

@Injectable()
export class ResearchService {
  constructor(private prisma: PrismaService, private queue: QueueService) {}

  async create(ownerId: string, dto: CreateResearchDto) {
    let projectId = dto.projectId;
    if (projectId) {
      const p = await this.prisma.project.findUnique({ where: { id: projectId } });
      if (!p) throw new NotFoundException('Project not found');
      if (p.ownerId !== ownerId) throw new ForbiddenException('Not your project');
    } else {
      const p = await this.prisma.project.create({ data: { ownerId, title: dto.question.slice(0, 80), description: 'Auto-created for research run' } });
      projectId = p.id;
    }
    if (dto.idempotencyKey) {
      const existing = await this.prisma.researchRun.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (existing) {
        if (existing.ownerId !== ownerId) throw new ForbiddenException('Idempotency key in use');
        return existing;
      }
    }
    const depth = dto.depth ?? 'standard';
    const run = await this.prisma.researchRun.create({
      data: {
        projectId: projectId!, ownerId, question: dto.question, depth,
        objectives: dto.objectives ?? [], status: 'queued',
        idempotencyKey: dto.idempotencyKey, demo: dto.demo ?? false,
        config: {
          dateFrom: dto.dateFrom, dateTo: dto.dateTo, sourceTypes: dto.sourceTypes ?? [],
          language: dto.language ?? 'en', maxSeconds: dto.maxSeconds ?? 600,
          searchBudget: dto.searchBudget ?? DEPTH_DEFAULTS[depth].maxSearches,
          includeDomains: dto.includeDomains ?? [], excludeDomains: dto.excludeDomains ?? [],
          ...DEPTH_DEFAULTS[depth],
        },
      },
    });
    await this.emit(run.id, 'research.started', { question: dto.question, depth, demo: run.demo });
    if (!run.demo) await this.queue.enqueue(run.id, ownerId, false);
    else await this.seedDemoRun(run.id);
    return run;
  }

  list(ownerId: string, page = 1, limit = 20, status?: string) {
    return this.prisma.researchRun.findMany({
      where: { ownerId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: Math.min(limit, 100),
      include: { project: { select: { title: true } } },
    });
  }

  async assertOwner(ownerId: string, id: string) {
    const run = await this.prisma.researchRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Research run not found');
    if (run.ownerId !== ownerId) throw new ForbiddenException('Not your research');
    return run;
  }

  async get(ownerId: string, id: string) { return this.assertOwner(ownerId, id); }
  async getPlan(ownerId: string, id: string) { await this.assertOwner(ownerId, id); return this.prisma.researchPlan.findUnique({ where: { runId: id } }); }
  async getSources(ownerId: string, id: string, page = 1, limit = 50) {
    await this.assertOwner(ownerId, id);
    return this.prisma.source.findMany({ where: { runId: id }, orderBy: { relevance: 'desc' }, skip: (page - 1) * limit, take: Math.min(limit, 100), include: { snapshot: true } });
  }
  async getEvidence(ownerId: string, id: string) {
    await this.assertOwner(ownerId, id);
    return this.prisma.evidence.findMany({ where: { runId: id }, orderBy: { relevance: 'desc' }, take: 200, include: { source: { select: { title: true, domain: true, canonicalUrl: true } } } });
  }
  async getClaims(ownerId: string, id: string) {
    await this.assertOwner(ownerId, id);
    return this.prisma.claim.findMany({ where: { runId: id }, take: 200, include: { links: { include: { evidence: { include: { source: { select: { title: true, domain: true, canonicalUrl: true } } } } } } } });
  }
  async getReport(ownerId: string, id: string) {
    await this.assertOwner(ownerId, id);
    return this.prisma.researchReport.findUnique({ where: { runId: id }, include: { sections: { orderBy: { ordinal: 'asc' } }, citations: true } });
  }
  async getGraph(ownerId: string, id: string) {
    await this.assertOwner(ownerId, id);
    const [entities, relations] = await Promise.all([
      this.prisma.knowledgeEntity.findMany({ where: { runId: id } }),
      this.prisma.knowledgeRelationship.findMany({ where: { runId: id } }),
    ]);
    return { nodes: entities, edges: relations };
  }
  async getEvents(ownerId: string, id: string, afterSeq = 0) {
    await this.assertOwner(ownerId, id);
    return this.prisma.agentEvent.findMany({ where: { runId: id, seq: { gt: afterSeq } }, orderBy: { seq: 'asc' }, take: 500 });
  }

  async cancel(ownerId: string, id: string) {
    const run = await this.assertOwner(ownerId, id);
    if (['completed', 'failed', 'cancelled'].includes(run.status)) return run;
    await this.queue.cancel(id);
    await this.prisma.researchRun.update({ where: { id }, data: { status: 'cancelled', finishedAt: new Date() } });
    await this.emit(id, 'research.cancelled', { reason: 'user-requested' });
    return this.prisma.researchRun.findUnique({ where: { id } });
  }

  async retry(ownerId: string, id: string) {
    const run = await this.assertOwner(ownerId, id);
    await this.prisma.researchRun.update({ where: { id }, data: { status: 'queued', finishedAt: null } });
    if (!run.demo) await this.queue.enqueue(id, ownerId, false);
    else await this.seedDemoRun(id);
    return { ok: true };
  }

  async exportMarkdown(ownerId: string, id: string) {
    const run = await this.assertOwner(ownerId, id);
    const report = await this.prisma.researchReport.findUnique({ where: { runId: id }, include: { sections: { orderBy: { ordinal: 'asc' } }, citations: true } });
    if (!report) throw new NotFoundException('Report not ready');
    let md = `# ${report.title}\n\n> DeepTrace AI · run ${id} · ${run.demo ? 'DEMONSTRATION DATA - not real research' : 'evidence-backed'}\n\n## Executive summary\n\n${report.summary}\n\n## Methodology\n\n${report.methodology}\n\n`;
    for (const s of report.sections) md += `## ${s.heading}\n\n${s.body}\n\n`;
    md += `## Gaps\n\n${((report.gaps as string[]) ?? []).map((g) => `- ${g}`).join('\n') || '_None recorded._'}\n\n## Limitations\n\n${((report.limitations as string[]) ?? []).map((l) => `- ${l}`).join('\n')}\n\n## Bibliography\n\n`;
    report.citations.forEach((c, i) => { md += `[${i + 1}] ${c.url} - "${c.passage.slice(0, 160)}..."\n`; });
    return { markdown: md, filename: `deeptrace-${id}.md` };
  }

  async exportPdf(ownerId: string, id: string) {
    const { markdown, filename } = await this.exportMarkdown(ownerId, id);
    const esc = markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return { html: `<!doctype html><html><body><pre style="font-family:serif;white-space:pre-wrap">${esc}</pre></body></html>`, filename: filename.replace(/\.md$/, '.html') };
  }

  async usage(ownerId: string) {
    const runs = await this.prisma.researchRun.findMany({ where: { ownerId }, select: { id: true } });
    const ids = runs.map((r) => r.id);
    if (!ids.length) return { runs: 0, promptTokens: 0, completionTokens: 0, estCostUsd: 0, note: 'Costs are estimates unless provider returns usage.' };
    const agg = await this.prisma.modelUsage.aggregate({ where: { runId: { in: ids } }, _sum: { promptTokens: true, completionTokens: true, estCostUsd: true } });
    return { runs: ids.length, promptTokens: agg._sum.promptTokens ?? 0, completionTokens: agg._sum.completionTokens ?? 0, estCostUsd: agg._sum.estCostUsd ?? 0, note: 'Costs are estimates unless provider returns usage.' };
  }

  async emit(runId: string, type: string, payload: Record<string, unknown> = {}) {
    const last = await this.prisma.agentEvent.findFirst({ where: { runId }, orderBy: { seq: 'desc' } });
    return this.prisma.agentEvent.create({ data: { runId, seq: (last?.seq ?? 0) + 1, type, payload } });
  }

  private async seedDemoRun(runId: string) {
    const run = await this.prisma.researchRun.findUnique({ where: { id: runId } });
    await this.prisma.researchRun.update({ where: { id: runId }, data: { status: 'running', startedAt: new Date() } });
    await this.emit(runId, 'plan.created', { note: 'demo plan', subquestions: ['What approaches exist?', 'Which datasets are used?', 'What are the gaps?'] });
    await this.prisma.researchPlan.upsert({ where: { runId }, update: {}, create: { runId, primaryQuestion: run?.question ?? 'Demo question', subquestions: ['What approaches exist?', 'Which datasets are used?', 'What are the gaps?'], objectives: ['Demonstrate report layout'], sourceTypes: ['demo'], queries: ['demo query 1', 'demo query 2'], completionCriteria: ['Demo report renders with citations'] } });
    const s1 = await this.prisma.source.upsert({ where: { runId_canonicalUrl: { runId, canonicalUrl: 'https://example.com/demo/sensor-fusion-survey' } }, update: {}, create: { runId, canonicalUrl: 'https://example.com/demo/sensor-fusion-survey', domain: 'example.com', title: 'DEMO - Sensor Fusion Survey (sample data)', contentHash: 'demo-1', relevance: 0.92, extractStatus: 'ok', includeReason: 'Demonstration source' } });
    const s2 = await this.prisma.source.upsert({ where: { runId_canonicalUrl: { runId, canonicalUrl: 'https://example.com/demo/eval-benchmarks' } }, update: {}, create: { runId, canonicalUrl: 'https://example.com/demo/eval-benchmarks', domain: 'example.com', title: 'DEMO - Evaluation Benchmarks (sample data)', contentHash: 'demo-2', relevance: 0.87, extractStatus: 'ok', includeReason: 'Demonstration source' } });
    await this.prisma.sourceSnapshot.upsert({ where: { sourceId: s1.id }, update: {}, create: { sourceId: s1.id, text: 'DEMO PASSAGE: Multi-modal fusion of EO imagery and radar tracks improves recall in cluttered airspace (illustrative sample).' } });
    const e1 = await this.prisma.evidence.create({ data: { runId, sourceId: s1.id, passage: 'Multi-modal fusion of EO imagery and radar tracks improves recall in cluttered airspace (demo passage).', relevance: 0.9, relation: 'supports', verifyStatus: 'supports', provenance: { demo: true } } });
    const c1 = await this.prisma.claim.create({ data: { runId, text: 'Sensor fusion can improve detection recall in cluttered airspace (DEMO claim - illustrative only).', category: 'fact', status: 'supports' } });
    await this.prisma.claimEvidence.create({ data: { claimId: c1.id, evidenceId: e1.id, relation: 'supports' } });
    const report = await this.prisma.researchReport.upsert({ where: { runId }, update: {}, create: { runId, title: `DEMO REPORT - ${(run?.question ?? '').slice(0, 90)}`, summary: 'Demonstration report using clearly labeled sample data; claims are illustrative, not findings.', methodology: 'Demo mode: no searches executed. Sample sources illustrate citations and evidence panels.', body: { demo: true }, gaps: ['Real dataset comparison requires live search.'], limitations: ['DEMONSTRATION DATA - do not cite as real research.', 'No live retrieval or verification performed.'] } });
    await this.prisma.reportSection.createMany({ data: [{ reportId: report.id, ordinal: 0, heading: 'Main findings', body: 'In this **sample**, fusion of EO + radar improves recall. Real runs replace this with verified findings [1].' }, { reportId: report.id, ordinal: 1, heading: 'Thematic analysis', body: 'Samples illustrate themes, comparisons, contradictions. Live runs synthesize from stored evidence.' }] });
    await this.prisma.citation.create({ data: { reportId: report.id, claimId: c1.id, sourceId: s1.id, evidenceId: e1.id, passage: e1.passage, url: s1.canonicalUrl } });
    await this.prisma.knowledgeEntity.createMany({ data: [{ runId, name: 'Sensor fusion', kind: 'concept' }, { runId, name: 'EO imagery', kind: 'concept' }, { runId, name: 'Radar tracks', kind: 'concept' }] });
    void s2;
    await this.emit(runId, 'report.completed', { demo: true });
    await this.prisma.researchRun.update({ where: { id: runId }, data: { status: 'completed', finishedAt: new Date() } });
  }
}
