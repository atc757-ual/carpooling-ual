import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  AccessTokenPayload,
  AuthenticatedRequest,
} from './access-token-payload';

// @CurrentUser() en un parámetro del controller devuelve el contenido del
// token (id y perfiles). No funciona en las rutas @Public (no hay token)
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenPayload =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
