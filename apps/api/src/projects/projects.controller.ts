import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

class CreateProjectDto { @IsString() @MaxLength(160) title!: string; @IsOptional() @IsString() @MaxLength(2000) description?: string; }
class PatchProjectDto { @IsOptional() @IsString() @MaxLength(160) title?: string; @IsOptional() @IsString() @MaxLength(2000) description?: string; }

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private svc: ProjectsService) {}
  @Get() list(@Req() req: { user: { id: string } }, @Query('page') page = '1', @Query('limit') limit = '20', @Query('q') q?: string) {
    return this.svc.list(req.user.id, Number(page), Math.min(Number(limit), 100), q).then((data) => ({ data }));
  }
  @Post() create(@Req() req: { user: { id: string } }, @Body() dto: CreateProjectDto) {
    return this.svc.create(req.user.id, dto.title, dto.description).then((data) => ({ data }));
  }
  @Get(':id') get(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.svc.get(req.user.id, id).then((data) => ({ data }));
  }
  @Patch(':id') patch(@Req() req: { user: { id: string } }, @Param('id') id: string, @Body() dto: PatchProjectDto) {
    return this.svc.patch(req.user.id, id, dto).then((data) => ({ data }));
  }
  @Delete(':id') remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.svc.remove(req.user.id, id).then((data) => ({ data }));
  }
}
