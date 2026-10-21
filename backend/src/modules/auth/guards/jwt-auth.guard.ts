import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import type { Request } from 'express';
import { AccessTokenPayload } from '../auth.service';
import { AccessTokenExpiredError } from '../errors/access-token-expired.error';
import { InvalidAccessTokenError } from '../errors/invalid-access-token.error';

// Petición ya autenticada: el guard deja en "user" el contenido del token
export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}

// Protege una ruta con @UseGuards(JwtAuthGuard): exige la cabecera
// "Authorization: Bearer <token>" con un token firmado por este servidor y sin
// caducar. No consulta la base de datos (backend sin estado)
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
