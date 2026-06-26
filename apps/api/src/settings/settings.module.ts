import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SettingsController } from './settings.controller';
import { PrismaService } from '../common/prisma.service';
import { ResearchService } from '../research/research.service';
import { QueueService } from '../research/queue.service';

@Module({ imports: [JwtModule.register({})], controllers: [SettingsController], providers: [PrismaService, ResearchService, QueueService] })
export class SettingsModule {}
