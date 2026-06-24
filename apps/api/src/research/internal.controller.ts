import { Body, Controller, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/** Internal callback — agent persists artifacts. Bearer AGENT_SERVICE_TOKEN. Prisma owns schema. */
@Controller('internal')
export class InternalController {
  constructor(private prisma: PrismaService) {}

  @Post('runs/:id/artifacts')
  async artifacts(@Param('id') id: string, @Headers('authorization') auth: string, @Body() body: { plan?: { primary_question?: string; subquestions?: string[]; objectives?: string[]; source_types?: string[]; queries?: string[]; completion_criteria?: string[] }; sources?: Array<{ url: string; title?: string; domain?: string; text?: string; hash?: string; relevance?: number }>; evidences?: Array<{ id?: string; source_id?: string; passage: string; chunk_ref?: string; start?: number; end?: number; relevance?: number }>; claims?: Array<{ text: string; category?: string; status?: string; evidence_id?: string }>; report?: { title: string; summary: string; methodology: string; findings?: Array<{ heading: string; body: string }>; gaps?: string[]; limitations?: string[]; citations?: Array<{ source_id: string; evidence_id: string; passage: string; url: string }> }; coverage?: unknown }) {
    if (auth !== `Bearer ${process.env.AGENT_SERVICE_TOKEN ?? 'change-me-internal-token'}`) throw new UnauthorizedException('bad internal token');
    const run = await this.prisma.researchRun.findUnique({ where: { id } });
    if (!run) throw new UnauthorizedException('unknown run');
    await this.prisma.$transaction(async (tx) => {
      if (body.plan) {
        await tx.researchPlan.upsert({
          where: { runId: id },
          update: {}, create: {
            runId: id, primaryQuestion: body.plan.primary_question ?? run.question,
            subquestions: body.plan.subquestions ?? [], objectives: body.plan.objectives ?? [],
            sourceTypes: body.plan.source_types ?? [], queries: body.plan.queries ?? [],
            completionCriteria: body.plan.completion_criteria ?? [],
          },
        });
        await tx.agentEvent.create({ data: { runId: id, seq: (await lastSeq(tx, id)) + 1, type: 'plan.created', payload: { subquestions: body.plan.subquestions ?? [] } } });
      }
      const sourceIdByAgent = new Map<string, string>();
      for (const s of body.sources ?? []) {
        const row = await tx.source.upsert({
          where: { runId_canonicalUrl: { runId: id, canonicalUrl: s.url } },
          update: { relevance: s.relevance ?? 0 }, create: {
            runId: id, canonicalUrl: s.url, domain: s.domain ?? '', title: s.title ?? s.url,
            contentHash: s.hash ?? s.url, relevance: s.relevance ?? 0, extractStatus: 'ok', includeReason: 'agent retrieval',
          },
        });
        sourceIdByAgent.set(s.url, row.id);
        if (s.text) await tx.sourceSnapshot.upsert({ where: { sourceId: row.id }, update: { text: s.text.slice(0, 20000) }, create: { sourceId: row.id, text: s.text.slice(0, 20000) } });
      }
      const evIdMap = new Map<string, string>();
      for (const e of body.evidences ?? []) {
        const agentSrc = (body.sources ?? []).find((s) => s.url && e.source_id === s.url);
        void agentSrc;
        const dbSourceId = [...sourceIdByAgent.values()][0];
        if (!dbSourceId) continue;
        const row = await tx.evidence.create({
          data: { runId: id, sourceId: dbSourceId, passage: e.passage.slice(0, 2000), chunkRef: e.chunk_ref, startOffset: e.start, endOffset: e.end, relevance: e.relevance ?? 0, provenance: { agent: true } },
        });
        if (e.id) evIdMap.set(e.id, row.id);
      }
      for (const c of body.claims ?? []) {
        const row = await tx.claim.create({ data: { runId: id, text: c.text.slice(0, 1000), category: c.category ?? 'fact', status: c.status ?? 'unverified' } });
        const evDb = c.evidence_id ? evIdMap.get(c.evidence_id) : undefined;
        if (evDb) await tx.claimEvidence.create({ data: { claimId: row.id, evidenceId: evDb, relation: 'supports' } });
      }
      if (body.report) {
        const rep = await tx.researchReport.upsert({
          where: { runId: id }, update: {},
          create: { runId: id, title: body.report.title.slice(0, 300), summary: body.report.summary.slice(0, 4000), methodology: body.report.methodology.slice(0, 4000), body: { findings: body.report.findings ?? [] }, gaps: body.report.gaps ?? [], limitations: body.report.limitations ?? [] },
        });
        const findings = body.report.findings ?? [];
        if (findings.length) await tx.reportSection.createMany({ data: findings.map((f, i) => ({ reportId: rep.id, ordinal: i, heading: f.heading.slice(0, 200), body: f.body.slice(0, 8000) })) });
        for (const cit of body.report.citations ?? []) {
          const srcDb = [...sourceIdByAgent.values()].includes(cit.source_id) ? cit.source_id : [...sourceIdByAgent.values()][0];
          const evDb = evIdMap.get(cit.evidence_id) ?? undefined;
          if (!srcDb) continue;
          await tx.citation.create({ data: { reportId: rep.id, sourceId: srcDb, evidenceId: evDb, passage: cit.passage.slice(0, 2000), url: cit.url } });
        }
      }
      await tx.researchRun.update({ where: { id }, data: { status: 'completed', finishedAt: new Date() } });
      await tx.agentEvent.create({ data: { runId: id, seq: (await lastSeq(tx, id)) + 1, type: 'report.completed', payload: { via: 'agent-callback' } } });
    });
    return { ok: true };
  }
}

async function lastSeq(tx: { agentEvent: { findFirst: (a: unknown) => Promise<{ seq: number } | null> } }, runId: string) {
  const last = await tx.agentEvent.findFirst({ where: { runId }, orderBy: { seq: 'desc' } });
  return last?.seq ?? 0;
}
