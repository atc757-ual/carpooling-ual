import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { ChangeTripsVehicleDto } from './dto/change-trips-vehicle.dto';
import { toTripResource, TripResource } from './dto/trip.resource';
import { TripVehiclesService } from './trip-vehicles.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Los viajes programados de un coche y el cambio de coche de varios viajes:
// lo que necesita el conductor antes de dar de baja un coche, o cuando uno
// falla de forma puntual
@ApiTags('trips')
@ApiBearerAuth()
@Profiles('driver')
@Controller()
export class TripVehiclesController {
  constructor(private readonly tripVehicles: TripVehiclesService) {}

  @Get('vehicles/:id/upcoming-trips')
  @ApiOperation({
    summary: 'List the upcoming trips of one of my vehicles',
    description:
      'Its published and confirmed trips, the soonest first: the ones that would block giving the vehicle up (VEHICLE_HAS_UPCOMING_TRIPS).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiPaginatedResponse(TripResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['VEHICLE_NOT_FOUND'],
  })
  async listUpcoming(
    @CurrentUser() driver: AccessTokenPayload,
    @Param('id', uuidParam('id')) vehicleId: string,
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TripResource[]> {
    const trips = await this.tripVehicles.listUpcoming(driver.sub, vehicleId);
    const items = trips.slice(
      pagination.offset,
      pagination.offset + pagination.limit,
    );
    setPaginationHeaders(response, { items, total: trips.length });
    return items.map(toTripResource);
  }

  // Operación de tarea (TMF630), como cancelar: cambia el coche de varios
  // viajes a la vez
  @Post('trips/vehicle-changes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Move some of my trips to another vehicle',
    description:
      'All or none. Only published or confirmed trips of the driver; the vehicle must be active, with its declaration up to date and room for the seats each trip offers. Accepted passengers are notified of the new vehicle.',
  })
  @ApiOkResponse({ type: [TripResource] })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED', 'SEATS_EXCEED_CAPACITY'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_TRIP_DRIVER'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND', 'VEHICLE_NOT_FOUND'],
    [HttpStatus.CONFLICT]: [
      'TRIP_NOT_EDITABLE',
      'VEHICLE_DECLARATION_REQUIRED',
    ],
  })
  async changeVehicle(
    @CurrentUser() driver: AccessTokenPayload,
    @Body() dto: ChangeTripsVehicleDto,
  ): Promise<TripResource[]> {
    const trips = await this.tripVehicles.changeVehicle(driver.sub, dto);
    return trips.map(toTripResource);
  }
}
