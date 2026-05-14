import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { ResearchModule } from './research/research.module';
import { SettingsModule } from './settings/settings.module';
import { HealthController } from './common/health.controller';
import { PrismaService } from './common/prisma.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    JwtModule.register({ global: true, secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-32-chars-minimum' }),
    AuthModule, ProjectsModule, ResearchModule, SettingsModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
