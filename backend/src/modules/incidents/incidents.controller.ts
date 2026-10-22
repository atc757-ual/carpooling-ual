import { Body, Controller, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import { IncidentResource, toIncidentResource } from './dto/incident.resource';
import { ReportIncidentDto } from './dto/report-incident.dto';
import { IncidentsService } from './incidents.service';

// Incidencias (RF-23). Sin @Profiles: las registran el conductor del viaje o
// un pasajero aceptado, y quién es cada uno lo decide IncidentsService
@ApiTags('incidents')
@ApiBearerAuth()
@Controller()
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post('trips/:tripId/incidents')
  @ApiOperation({
    summary: 'Report an incident and cancel during a trip in progress',
    description:
      'RF-23. If the driver reports it, the trip is cancelled and its accepted passengers get priority (RF-24). If an accepted passenger reports it, only their seat request is cancelled and the trip goes on.',
  })
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiCreatedResponse({ type: IncidentResource })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.FORBIDDEN]: ['NOT_TRIP_PASSENGER'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['TRIP_NOT_IN_PROGRESS'],
  })
  async report(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', uuidParam('tripId')) tripId: string,
    @Body() dto: ReportIncidentDto,
  ): Promise<IncidentResource> {
    return toIncidentResource(
      await this.incidentsService.report(user.sub, tripId, dto),
    );
  }
}
