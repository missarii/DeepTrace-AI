import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ResearchController } from './research.controller';
import { InternalController } from './internal.controller';
import { ResearchService } from './research.service';
import { QueueService } from './queue.service';
import { PrismaService } from '../common/prisma.service';

@Module({ imports: [JwtModule.register({})], controllers: [ResearchController, InternalController], providers: [ResearchService, QueueService, PrismaService], exports: [ResearchService] })
export class ResearchModule {}
