import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}
  @Get() async health() { return { status: 'ok', time: new Date().toISOString() }; }
  @Get('ready') async ready() {
    const checks: Record<string, string> = {};
    try { await this.prisma.$queryRaw`SELECT 1`; checks.db = 'ok'; } catch { checks.db = 'fail'; }
    try {
      const r = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: 1 });
      await r.ping(); checks.redis = 'ok'; r.disconnect();
    } catch { checks.redis = 'fail'; }
    try {
      const res = await fetch(`${process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000'}/health`);
      checks.agent = res.ok ? 'ok' : 'fail';
    } catch { checks.agent = 'fail'; }
    const ok = Object.values(checks).every((v) => v === 'ok');
    return { status: ok ? 'ready' : 'degraded', checks };
  }
}
