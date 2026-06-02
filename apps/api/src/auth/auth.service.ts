import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.service';

const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '15m';
const REFRESH_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(email: string, password: string, name?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({ data: { email: email.toLowerCase(), passwordHash, name, settings: { create: {} } } });
    await this.prisma.auditEvent.create({ data: { userId: user.id, action: 'auth.register' } });
    return this.issueSession(user.id, user.email);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await argon2.verify(user.passwordHash, password))) throw new UnauthorizedException('Invalid credentials');
    return this.issueSession(user.id, user.email);
  }

  async refresh(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw new UnauthorizedException('Invalid refresh token');
    // rotate
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueSession(stored.userId, stored.user.email);
  }

  async logout(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, createdAt: true } });
  }

  async deleteUserData(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true };
  }

  private async issueSession(userId: string, email: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId, email }, { secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-32-chars-minimum', expiresIn: ACCESS_TTL });
    const raw = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    await this.prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 864e5) } });
    return { accessToken, refreshToken: raw, tokenType: 'Bearer' as const };
  }
}
