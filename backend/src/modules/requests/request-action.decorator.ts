import { applyDecorators, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import type { ProfileType } from '../users/profile-type';
import { SeatRequestResource } from './dto/seat-request.resource';

interface RequestActionOptions {
  // POST /api/requests/:id/<action>
  action: 'cancel' | 'accept' | 'reject' | 'board' | 'no-show';
  profile: ProfileType;
  summary: string;
  description?: string;
  // El 403 de quien no es su pasajero o el conductor del viaje
  notAllowedCode: string;
  conflictCodes: string[];
}

// Una acción sobre una solicitud (cancelar, aceptar o rechazar): la ruta, el
// perfil que la puede hacer, 200 con la solicitud y su documentación OpenAPI
// con los errores comunes a las tres
export function RequestAction(options: RequestActionOptions): MethodDecorator {
  return applyDecorators(
    Post(`requests/:id/${options.action}`),
    Profiles(options.profile),
    HttpCode(HttpStatus.OK),
    ApiOperation({
      summary: options.summary,
      description: options.description,
    }),
    ApiParam({ name: 'id', format: 'uuid' }),
    ApiOkResponse({ type: SeatRequestResource }),
    ApiErrorResponses({
      [HttpStatus.UNAUTHORIZED]: [
        'INVALID_ACCESS_TOKEN',
        'ACCESS_TOKEN_EXPIRED',
      ],
      [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
      [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', options.notAllowedCode],
      [HttpStatus.NOT_FOUND]: ['REQUEST_NOT_FOUND'],
      [HttpStatus.CONFLICT]: options.conflictCodes,
    }),
  );
}
