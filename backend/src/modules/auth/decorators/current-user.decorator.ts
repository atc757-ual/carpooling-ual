import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccessTokenPayload } from '../auth.service';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

// @CurrentUser() en un parámetro del controller devuelve el contenido del
// token (id y perfiles). Solo tiene sentido en rutas con JwtAuthGuard
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenPayload =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
