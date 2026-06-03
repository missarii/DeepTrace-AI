import { Body, Controller, Delete, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register') async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.register(dto.email, dto.password, dto.name);
    this.setCookies(res, s);
    return { data: s };
  }
  @Post('login') async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.login(dto.email, dto.password);
    this.setCookies(res, s);
    return { data: s };
  }
  @Post('refresh') async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.body?.refreshToken ?? req.cookies?.refresh_token;
    const s = await this.auth.refresh(raw);
    this.setCookies(res, s);
    return { data: s };
  }
  @Post('logout') async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.body?.refreshToken ?? req.cookies?.refresh_token;
    if (raw) await this.auth.logout(raw);
    res.clearCookie('access_token'); res.clearCookie('refresh_token');
    return { data: { ok: true } };
  }
  @Get('me') @UseGuards(JwtAuthGuard) async me(@Req() req: Request) {
    return { data: await this.auth.me((req as unknown as { user: { id: string } }).user.id) };
  }
  @Delete('me') @UseGuards(JwtAuthGuard) async deleteMe(@Req() req: Request) {
    return { data: await this.auth.deleteUserData((req as unknown as { user: { id: string } }).user.id) };
  }
  private setCookies(res: Response, s: { accessToken: string; refreshToken: string }) {
    res.cookie('access_token', s.accessToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 15 * 60e3 });
    res.cookie('refresh_token', s.refreshToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/v1/auth', maxAge: 7 * 864e5 });
  }
}
