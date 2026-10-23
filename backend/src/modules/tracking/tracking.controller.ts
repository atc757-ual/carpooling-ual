import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import { ReportPositionDto } from './dto/report-position.dto';
import {
  toTripPositionResource,
  TripPositionResource,
} from './dto/trip-position.resource';
import { TripPositionsService } from './trip-positions.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Seguimiento real del viaje (RF-12, CU-08): el conductor envía su posición y
// él y sus pasajeros aceptados la consultan (cada ~10 s, por consulta
// periódica; el tiempo real con WebSocket es una ampliación)
@ApiTags('tracking')
@ApiBearerAuth()
@Controller('trips/:tripId')
export class TrackingController {
  constructor(private readonly positionsService: TripPositionsService) {}

  @Post('positions')
  @Profiles('driver')
  @ApiOperation({
    summary: 'Report my position during a trip in progress',
    description:
      'Only the driver of the trip, while it is in progress, at most once every POSITION_MIN_INTERVAL_SECONDS (10 by default). The remaining distance and time are calculated with OSRM.',
  })
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiCreatedResponse({
    type: TripPositionResource,
    headers: { Location: { description: 'Link to the current position' } },
  })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_TRIP_DRIVER'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['TRIP_NOT_IN_PROGRESS', 'POSITION_TOO_FREQUENT'],
  })
  async report(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', uuidParam('tripId')) tripId: string,
    @Body() dto: ReportPositionDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TripPositionResource> {
    const position = toTripPositionResource(
      await this.positionsService.report(user.sub, tripId, dto.position),
    );
    response.setHeader('Location', position.href);
    return position;
  }

  @Get('position')
  @ApiOperation({
    summary: 'Get the current position of the driver',
    description:
      'Only the driver and the accepted passengers of the trip. It exists while the trip is in progress; it is deleted when the trip ends.',
  })
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiOkResponse({ type: TripPositionResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['NOT_TRIP_PASSENGER'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND', 'POSITION_NOT_FOUND'],
  })
  async getLatest(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', uuidParam('tripId')) tripId: string,
  ): Promise<TripPositionResource> {
    return toTripPositionResource(
      await this.positionsService.getLatest(user.sub, tripId),
    );
  }
}
