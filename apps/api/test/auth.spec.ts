import { Test } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';

describe('AuthService (unit)', () => {
  it('rejects invalid refresh token', async () => {
    const prisma = { refreshToken: { findUnique: async () => null } };
    const svc = new AuthService(prisma as never, {} as never);
    await expect(svc.refresh('bad')).rejects.toThrow();
  });
});
