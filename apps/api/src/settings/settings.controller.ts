import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ResearchService } from '../research/research.service';

class PatchSettingsDto {
  @IsOptional() @IsString() chatProvider?: string;
  @IsOptional() @IsString() chatModel?: string;
  @IsOptional() @IsString() searchProvider?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) maxIterations?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) maxSearchCalls?: number;
  @IsOptional() @IsInt() @Min(30) @Max(3600) maxRunSeconds?: number;
}

@ApiTags('settings')
@Controller()
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private prisma: PrismaService, private research: ResearchService) {}
  @Get('settings') async get(@Req() req: { user: { id: string } }) {
    const s = await this.prisma.userSettings.upsert({ where: { userId: req.user.id }, update: {}, create: { userId: req.user.id } });
    // Never return secrets — provider keys live in env only for this release.
    return { data: { ...s, secretConfigured: { tavily: !!process.env.TAVILY_API_KEY, brave: !!process.env.BRAVE_API_KEY, openai: !!process.env.OPENAI_API_KEY, anthropic: !!process.env.ANTHROPIC_API_KEY } } };
  }
  @Patch('settings') async patch(@Req() req: { user: { id: string } }, @Body() dto: PatchSettingsDto) {
    const data = await this.prisma.userSettings.upsert({ where: { userId: req.user.id }, update: dto, create: { userId: req.user.id, ...dto } });
    return { data };
  }
  @Get('usage') async usage(@Req() req: { user: { id: string } }) {
    return { data: await this.research.usage(req.user.id) };
  }
}
