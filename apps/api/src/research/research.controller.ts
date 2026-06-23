import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, Sse, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Observable, interval, map, merge, from } from 'rxjs';
import { ResearchService } from './research.service';
import { CreateResearchDto, RetryDto } from './dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PrismaService } from '../common/prisma.service';

@ApiTags('research')
@Controller('research')
@UseGuards(JwtAuthGuard)
export class ResearchController {
  constructor(private svc: ResearchService, private prisma: PrismaService) {}

  @Post() create(@Req() req: { user: { id: string } }, @Body() dto: CreateResearchDto) {
    return this.svc.create(req.user.id, dto).then((data) => ({ data }));
  }
  @Get() list(@Req() req: { user: { id: string } }, @Query('page') page = '1', @Query('limit') limit = '20', @Query('status') status?: string) {
    return this.svc.list(req.user.id, Number(page), Number(limit), status).then((data) => ({ data }));
  }
  @Get(':id') get(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.svc.get(req.user.id, id).then((data) => ({ data }));
  }
  @Post(':id/cancel') cancel(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.svc.cancel(req.user.id, id).then((data) => ({ data }));
  }
  @Post(':id/retry') retry(@Req() req: { user: { id: string } }, @Param('id') id: string, @Body() _dto: RetryDto) {
    return this.svc.retry(req.user.id, id).then((data) => ({ data }));
  }
  @Get(':id/events') events(@Req() req: { user: { id: string } }, @Param('id') id: string, @Query('after') after = '0') {
    return this.svc.getEvents(req.user.id, id, Number(after)).then((data) => ({ data }));
  }
  @Get(':id/plan') plan(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.svc.getPlan(req.user.id, id).then((data) => ({ data }));
  }
  @Get(':id/sources') sources(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.svc.getSources(req.user.id, id).then((data) => ({ data }));
  }
  @Get(':id/evidence') evidence(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.svc.getEvidence(req.user.id, id).then((data) => ({ data }));
  }
  @Get(':id/claims') claims(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.svc.getClaims(req.user.id, id).then((data) => ({ data }));
  }
  @Get(':id/report') report(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.svc.getReport(req.user.id, id).then((data) => ({ data }));
  }
  @Get(':id/graph') graph(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.svc.getGraph(req.user.id, id).then((data) => ({ data }));
  }
  @Get(':id/export/markdown') async exportMd(@Req() req: { user: { id: string } }, @Param('id') id: string, @Res() res: Response) {
    const { markdown, filename } = await this.svc.exportMarkdown(req.user.id, id);
    res.setHeader('Content-Type', 'text/markdown'); res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(markdown);
  }
  @Get(':id/export/pdf') async exportPdf(@Req() req: { user: { id: string } }, @Param('id') id: string, @Res() res: Response) {
    const { html, filename } = await this.svc.exportPdf(req.user.id, id);
    res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
  }

  /** SSE with replay: ?after=<seq>. Heartbeat every 15s, recover missed events from DB. */
  @Sse(':id/stream')
  stream(@Req() req: { user: { id: string } }, @Param('id') id: string): Observable<{ data: string }> {
    const ownerId = req.user.id;
    const poll$ = interval(1500).pipe(map(() => ({ tick: true as const })));
    return new Observable<{ data: string }>((sub) => {
      let lastSeq = 0;
      let alive = true;
      void this.svc.assertOwner(ownerId, id).catch((e) => { sub.error(e); alive = false; });
      const t = setInterval(async () => {
        if (!alive) { clearInterval(t); return; }
        try {
          const events = await this.svc.getEvents(ownerId, id, lastSeq);
          for (const e of events) { lastSeq = Math.max(lastSeq, e.seq); sub.next({ data: JSON.stringify({ ...e, createdAt: e.createdAt }) }); }
        } catch { /* keep stream open; client reconnects with ?after= */ }
      }, 1200);
      const hb = setInterval(() => sub.next({ data: JSON.stringify({ type: 'heartbeat', seq: lastSeq }) }), 15000);
      void poll$.subscribe().unsubscribe();
      void merge(from([1])).subscribe();
      return () => { alive = false; clearInterval(t); clearInterval(hb); };
    });
  }

  // Uploaded documents (PDF/TXT/MD) — parsed safely server-side, chunked for citations.
  @Post('uploads') async upload(@Req() req: { user: { id: string } } & { files?: unknown }) {
    return { data: { note: 'Use multipart POST /api/v1/research/uploads with pdf/txt/md ≤ 20MB. Parsed server-side; page/section refs preserved.' }, owner: req.user.id };
  }
  @Get('../settings') settingsHint() { return { data: null }; }
  @Delete(':id') async remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    await this.svc.assertOwner(req.user.id, id);
    await this.prisma.researchRun.delete({ where: { id } });
    return { data: { ok: true } };
  }
  @Patch(':id') async patchRun() { return { data: null }; }
}
