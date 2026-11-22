import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  RelocationOptionsResource,
  toRelocationOptionsResource,
} from './dto/request-relocation.resource';
import { RelocationService } from './relocation.service';

// Otros viajes para el pasajero cuyo conductor canceló (15/11/2026 y
// 22/11/2026). Solo consulta: la plaza la pide él desde el detalle del viaje
@ApiTags('matching')
@ApiBearerAuth()
@Controller('requests')
export class RelocationController {
  constructor(private readonly relocationService: RelocationService) {}

  @Get(':id/relocation-options')
  @Profiles('passenger')
  @ApiOperation({
    summary: 'Trips like mine after the driver cancelled it',
    description:
      'Only for a request cancelled because its driver cancelled the trip, in the 30 minutes after the cancellation. Returns the trips going the same way, to the same campus parking and with the seats needed, by priority: the one that matches exactly (±15 min, picking the passenger up at the same point) in exactMatch, the others leaving within ±20 min in matches and the rest of that day in sameDayMatches. It requests nothing: the passenger requests the seat as usual.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RelocationOptionsResource })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_REQUEST_PASSENGER'],
    [HttpStatus.NOT_FOUND]: ['REQUEST_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['REQUEST_NOT_RELOCATABLE'],
  })
  async findOptions(
    @CurrentUser() passenger: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<RelocationOptionsResource> {
    return toRelocationOptionsResource(
      await this.relocationService.findOptions(passenger.sub, id),
    );
  }
}
