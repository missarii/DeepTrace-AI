import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.access_token;
    if (!token) throw new UnauthorizedException('Missing access token');
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-32-chars-minimum' });
      req.user = { id: payload.sub, email: payload.email };
      req.requestId = req.headers['x-request-id'] ?? crypto.randomUUID();
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
