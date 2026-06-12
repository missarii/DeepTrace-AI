import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}
  list(ownerId: string, page = 1, limit = 20, q?: string) {
    return this.prisma.project.findMany({
      where: { ownerId, ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      include: { _count: { select: { runs: true } } },
    });
  }
  create(ownerId: string, title: string, description?: string) {
    return this.prisma.project.create({ data: { ownerId, title, description } });
  }
  async get(ownerId: string, id: string) {
    const p = await this.prisma.project.findUnique({ where: { id }, include: { runs: { orderBy: { createdAt: 'desc' }, take: 20 } } });
    if (!p) throw new NotFoundException('Project not found');
    if (p.ownerId !== ownerId) throw new ForbiddenException('Not your project');
    return p;
  }
  async patch(ownerId: string, id: string, data: { title?: string; description?: string }) {
    await this.get(ownerId, id);
    return this.prisma.project.update({ where: { id }, data });
  }
  async remove(ownerId: string, id: string) {
    await this.get(ownerId, id);
    await this.prisma.project.delete({ where: { id } });
    return { ok: true };
  }
}
