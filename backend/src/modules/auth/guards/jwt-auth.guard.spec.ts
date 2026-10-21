import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest } from '../../../shared/auth/access-token-payload';
import { Public } from '../../../shared/auth/public.decorator';
import { AccessTokenExpiredError } from '../errors/access-token-expired.error';
import { InvalidAccessTokenError } from '../errors/invalid-access-token.error';
import { JwtAuthGuard } from './jwt-auth.guard';

// Controller de ejemplo: sus métodos llevan las mismas etiquetas que los reales
class SampleController {
  @Public()
  open(this: void): void {}

  closed(this: void): void {}
}

describe('JwtAuthGuard', () => {
  const jwtService = new JwtService({
    secret: 'test-only-secret-with-at-least-32-chars',
  });
  const guard = new JwtAuthGuard(jwtService, new Reflector());

  function contextWith(
    authorization?: string,
    handler: keyof SampleController = 'closed',
  ): {
    context: ExecutionContext;
    request: AuthenticatedRequest;
  } {
    const request = {
      get: () => authorization,
    } as unknown as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => SampleController.prototype[handler],
      getClass: () => SampleController,
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it('lets a @Public route through without a token', async () => {
    const { context } = contextWith(undefined, 'open');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('accepts a valid token and leaves its content in request.user', async () => {
    const token = await jwtService.signAsync({
      sub: 'user-1',
      profiles: ['driver'],
    });
    const { context, request } = contextWith(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ sub: 'user-1', profiles: ['driver'] });
  });

  it.each([
    ['no Authorization header', undefined],
    ['another scheme', 'Basic dXNlcjpwYXNz'],
    ['"Bearer" without token', 'Bearer '],
    ['a malformed token', 'Bearer not-a-jwt'],
  ])('rejects a request with %s', async (_case, authorization) => {
    const { context } = contextWith(authorization);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new JwtService({
      secret: 'another-secret-with-at-least-32-chars!!',
    }).signAsync({ sub: 'user-1', profiles: ['admin'] });
    const { context } = contextWith(`Bearer ${forged}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rejects an expired token with its own error', async () => {
    const expired = await jwtService.signAsync({
      sub: 'user-1',
      profiles: ['driver'],
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const { context } = contextWith(`Bearer ${expired}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      AccessTokenExpiredError,
    );
  });
});
