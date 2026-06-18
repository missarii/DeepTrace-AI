import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../common/prisma.service';

@Module({ imports: [JwtModule.register({})], controllers: [ProjectsController], providers: [ProjectsService, PrismaService] })
export class ProjectsModule {}
