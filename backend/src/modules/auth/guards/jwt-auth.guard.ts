import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import {
  AccessTokenPayload,
  AuthenticatedRequest,
} from '../../../shared/auth/access-token-payload';
import { IS_PUBLIC_KEY } from '../../../shared/auth/public.decorator';
import { AccessTokenExpiredError } from '../errors/access-token-expired.error';
import { InvalidAccessTokenError } from '../errors/invalid-access-token.error';

// Guard global (APP_GUARD en AuthModule): TODA la API exige la cabecera
// "Authorization: Bearer <token>" con un token firmado por este servidor y sin
// caducar, salvo las rutas marcadas con @Public(). No consulta la base de
// datos (backend sin estado)
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @Public() puede estar en el método o en todo el controller
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.get('Authorization'));
    if (token === null) {
      throw new InvalidAccessTokenError();
    }

    try {
      request.user =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch (error) {
      throw error instanceof TokenExpiredError
        ? new AccessTokenExpiredError()
        : new InvalidAccessTokenError();
    }
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : null;
}
