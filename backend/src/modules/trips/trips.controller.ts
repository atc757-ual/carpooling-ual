import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import {
  RequestValidationError,
  uuidParam,
} from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { PublishTripDto } from './dto/publish-trip.dto';
import {
  PublishingStatusResource,
  toPublishingStatusResource,
} from './dto/publishing-status.resource';
import {
  toTripRouteResource,
  TripRouteResource,
} from './dto/trip-route.resource';
import { toTripResource, TripResource } from './dto/trip.resource';
import { UpdateTripDto } from './dto/update-trip.dto';
import { LateCancellationsService } from './late-cancellations.service';
import { TripsService } from './trips.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Errores comunes de publicar y modificar (reglas de TripsService)
const TRIP_RULE_ERRORS = [
  'VALIDATION_FAILED',
  'SEATS_EXCEED_CAPACITY',
  'DEPARTURE_IN_THE_PAST',
  'DEPARTURE_TOO_SOON',
];

// Viajes (RF-04, RF-05). Cualquier usuario autenticado puede ver un viaje;
// publicar, modificar y cancelar es del conductor
@ApiTags('trips')
@ApiBearerAuth()
@Controller()
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly lateCancellations: LateCancellationsService,
  ) {}

  @Post('trips')
  @Profiles('driver')
  @ApiOperation({
    summary: 'Publish a trip',
    description:
      'RF-04. The driver must be ready (RF-21): responsible declaration accepted and at least one active vehicle. The departure must be at least one hour away, and publishing is suspended for 7 days after 3 late cancellations in 30 days.',
  })
  @ApiCreatedResponse({
    type: TripResource,
    headers: { Location: { description: 'Link to the new trip' } },
  })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: TRIP_RULE_ERRORS,
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'DRIVER_NOT_READY'],
    [HttpStatus.NOT_FOUND]: ['VEHICLE_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['PUBLISHING_SUSPENDED'],
  })
  async publish(
    @CurrentUser() driver: AccessTokenPayload,
    @Body() dto: PublishTripDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TripResource> {
    const trip = toTripResource(
      await this.tripsService.publish(driver.sub, dto),
    );
    response.setHeader('Location', trip.href);
    return trip;
  }

  @Get('trips/:id')
  @ApiOperation({ summary: 'Get a trip' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TripResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
  })
  async getOne(
    @Param('id', uuidParam('id')) id: string,
  ): Promise<TripResource> {
    return toTripResource(await this.tripsService.getById(id));
  }

  @Get('trips/:id/route')
  @ApiOperation({
    summary: 'Get the route of a trip and its estimated arrival',
    description:
      'RF-12, CU-08. The road route calculated with OSRM (or estimated if OSRM did not answer), with the trip status.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TripRouteResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND', 'ROUTE_NOT_FOUND'],
  })
  async getRoute(
    @Param('id', uuidParam('id')) id: string,
  ): Promise<TripRouteResource> {
    return toTripRouteResource(await this.tripsService.getRoute(id));
  }

  @Get('users/me/trips')
  @Profiles('driver')
  @ApiOperation({
    summary: 'List my trips as a driver',
    description: 'Ordered by departure time, the soonest first.',
  })
  @ApiPaginatedResponse(TripResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async listMine(
    @CurrentUser() driver: AccessTokenPayload,
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TripResource[]> {
    const page = await this.tripsService.listByDriver(driver.sub, pagination);
    setPaginationHeaders(response, page);
    return page.items.map(toTripResource);
  }

  // Cancelaciones tardías del conductor y si puede publicar (Publicar avisa
  // antes de rellenar nada; Mis viajes, al cancelar)
  @Get('users/me/publishing-status')
  @Profiles('driver')
  @ApiOperation({
    summary: 'Get my publishing status',
    description:
      'Late cancellations in the last 30 days and, after 3, until when publishing is suspended (7 days from the last one).',
  })
  @ApiOkResponse({ type: PublishingStatusResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async getPublishingStatus(
    @CurrentUser() driver: AccessTokenPayload,
  ): Promise<PublishingStatusResource> {
    return toPublishingStatusResource(
      await this.lateCancellations.getPublishingStatus(driver.sub),
    );
  }

  @Patch('trips/:id')
  @Profiles('driver')
  @ApiOperation({
    summary: 'Change a published trip',
    description:
      'RF-05. Only its driver, and only while it is published (no accepted passengers). Send only the fields that change.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TripResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: TRIP_RULE_ERRORS,
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_TRIP_DRIVER'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND', 'VEHICLE_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['TRIP_NOT_EDITABLE'],
  })
  async update(
    @CurrentUser() driver: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
    @Body() dto: UpdateTripDto,
  ): Promise<TripResource> {
    // Un PATCH sin ningún campo no cambia nada: se rechaza en vez de
    // registrar un evento vacío
    if (Object.keys(dto).length === 0) {
      throw new RequestValidationError([
        { field: 'body', reason: 'at least one field must be sent' },
      ]);
    }
    return toTripResource(await this.tripsService.update(driver.sub, id, dto));
  }

  // Operación de tarea (TMF630): cancelar no es editar un campo, es una
  // acción con sus propias reglas
  @Post('trips/:id/cancel')
  @Profiles('driver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a trip before it starts',
    description:
      'RF-05. Only its driver. With accepted passengers and less than 30 minutes before the departure, it counts as a late cancellation (see GET /users/me/publishing-status). Once started, cancelling requires an incident (RF-23).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TripResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_TRIP_DRIVER'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['TRIP_ALREADY_STARTED', 'INVALID_TRIP_TRANSITION'],
  })
  async cancel(
    @CurrentUser() driver: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<TripResource> {
    return toTripResource(await this.tripsService.cancel(driver.sub, id));
  }

  // RF-11: iniciar y finalizar, operaciones de tarea como cancelar
  @Post('trips/:id/start')
  @Profiles('driver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start a confirmed trip',
    description:
      'RF-11. Only its driver, from 10 minutes before the departure. The vehicle goes on trip, the pending seat requests are rejected and the accepted passengers are told the driver is on the way.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TripResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_TRIP_DRIVER'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND', 'VEHICLE_NOT_FOUND'],
    [HttpStatus.CONFLICT]: [
      'TRIP_NOT_STARTABLE_YET',
      'VEHICLE_IN_USE',
      'INVALID_TRIP_TRANSITION',
    ],
  })
  async start(
    @CurrentUser() driver: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<TripResource> {
    return toTripResource(await this.tripsService.start(driver.sub, id));
  }

  @Post('trips/:id/finish')
  @Profiles('driver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finish a trip in progress',
    description: 'RF-11. Only its driver. The vehicle is available again.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TripResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_TRIP_DRIVER'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['INVALID_TRIP_TRANSITION'],
  })
  async finish(
    @CurrentUser() driver: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<TripResource> {
    return toTripResource(await this.tripsService.finish(driver.sub, id));
  }
}
