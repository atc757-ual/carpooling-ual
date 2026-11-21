import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  DigitalTwinResource,
  toDigitalTwinResource,
} from './dto/digital-twin.resource';
import { TripTwinResource, toTripTwinResource } from './dto/trip-twin.resource';
import { DigitalTwinSyncService } from './sync/digital-twin-sync.service';

// El Gemelo Digital en el panel (RF-13, RF-14). Solo para administradores
@ApiTags('digital twin')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/digital-twin')
export class DigitalTwinController {
  constructor(private readonly sync: DigitalTwinSyncService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the state of the live digital twin',
    description:
      'Trips, vehicles and users by status, the passengers on board, the last event applied and the lag between an event and the twin (RNF-07).',
  })
  @ApiOkResponse({ type: DigitalTwinResource })
  @ApiErrorResponses({
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  get(): DigitalTwinResource {
    return toDigitalTwinResource(this.sync.twin.summary(), this.sync.status());
  }

  @Get('trips/:id')
  @ApiOperation({
    summary: 'Get the twin of a trip with its route',
    description:
      'Status, seats and passengers on board of the trip, and its route as part of its state (RF-13): the planned one (origin, stops, pickups of the accepted passengers and destination) and, while it is in progress, the positions of the driver with the km travelled. Once the trip is closed, the origin, the pickup points and the track are forgotten.',
  })
  @ApiOkResponse({ type: TripTwinResource })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['TRIP_TWIN_NOT_FOUND'],
  })
  getTrip(@Param('id', uuidParam('id')) id: string): TripTwinResource {
    return toTripTwinResource(this.sync.getTrip(id));
  }
}
