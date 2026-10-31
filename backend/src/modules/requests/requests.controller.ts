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
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { LateCancellationsService } from '../trips/late-cancellations.service';
import { RequestSeatsDto } from './dto/request-seats.dto';
import {
  RequestingStatusResource,
  toRequestingStatusResource,
} from './dto/requesting-status.resource';
import {
  SeatRequestResource,
  toSeatRequestResource,
} from './dto/seat-request.resource';
import { RequestsService } from './requests.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Solicitudes de plaza (RF-08 a RF-10). El pasajero solicita y cancela; el
// conductor del viaje acepta o rechaza. Solo ellos dos ven cada solicitud
@ApiTags('seat requests')
@ApiBearerAuth()
@Controller()
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly lateCancellations: LateCancellationsService,
  ) {}

  // --- Pasajero

  @Post('trips/:tripId/requests')
  @Profiles('passenger')
  @ApiOperation({
    summary: 'Request a seat in a trip',
    description:
      'RF-08. For the passenger and their companions (1 seat by default, up to 4). The trip must be published or confirmed, not yet departed, with enough seats left and not your own.',
  })
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiCreatedResponse({
    type: SeatRequestResource,
    headers: { Location: { description: 'Link to the new seat request' } },
  })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
    [HttpStatus.CONFLICT]: [
      'TRIP_NOT_OPEN',
      'TRIP_FULL',
      'CANNOT_REQUEST_OWN_TRIP',
      'REQUEST_ALREADY_EXISTS',
      'REQUESTING_SUSPENDED',
    ],
  })
  async request(
    @CurrentUser() passenger: AccessTokenPayload,
    @Param('tripId', uuidParam('tripId')) tripId: string,
    @Body() body: RequestSeatsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SeatRequestResource> {
    const request = toSeatRequestResource(
      await this.requestsService.request(passenger.sub, tripId, body.seats),
    );
    response.setHeader('Location', request.href);
    return request;
  }

  @Get('users/me/requests')
  @Profiles('passenger')
  @ApiOperation({ summary: 'List my seat requests, the newest first' })
  @ApiPaginatedResponse(SeatRequestResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async listMine(
    @CurrentUser() passenger: AccessTokenPayload,
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SeatRequestResource[]> {
    const page = await this.requestsService.listForPassenger(
      passenger.sub,
      pagination,
    );
    setPaginationHeaders(response, page);
    return page.items.map(toSeatRequestResource);
  }

  // Cancelaciones tardías del pasajero y si puede pedir plaza (el detalle del
  // viaje avisa antes de solicitar)
  @Get('users/me/requesting-status')
  @Profiles('passenger')
  @ApiOperation({
    summary: 'Get my requesting status',
    description:
      'Late cancellations in the last 30 days and, after 3, until when requesting seats is suspended (7 days from the last one).',
  })
  @ApiOkResponse({ type: RequestingStatusResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async getRequestingStatus(
    @CurrentUser() passenger: AccessTokenPayload,
  ): Promise<RequestingStatusResource> {
    return toRequestingStatusResource(
      await this.lateCancellations.getRequestingStatus(passenger.sub),
    );
  }

  @Post('requests/:id/cancel')
  @Profiles('passenger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel my seat request',
    description:
      'Before the trip starts. An accepted request gives its seat back (RF-10). Once started, it requires an incident (RF-23).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SeatRequestResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_REQUEST_PASSENGER'],
    [HttpStatus.NOT_FOUND]: ['REQUEST_NOT_FOUND'],
    [HttpStatus.CONFLICT]: [
      'TRIP_ALREADY_STARTED',
      'INVALID_REQUEST_TRANSITION',
    ],
  })
  async cancel(
    @CurrentUser() passenger: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<SeatRequestResource> {
    return toSeatRequestResource(
      await this.requestsService.cancel(passenger.sub, id),
    );
  }

  // --- Conductor

  @Get('trips/:tripId/requests')
  @Profiles('driver')
  @ApiOperation({
    summary: 'List the seat requests of my trip',
    description: 'Priority requests first (RF-24), then by arrival.',
  })
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiPaginatedResponse(SeatRequestResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_TRIP_DRIVER'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
  })
  async listForTrip(
    @CurrentUser() driver: AccessTokenPayload,
    @Param('tripId', uuidParam('tripId')) tripId: string,
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SeatRequestResource[]> {
    const page = await this.requestsService.listForTrip(
      driver.sub,
      tripId,
      pagination,
    );
    setPaginationHeaders(response, page);
    return page.items.map(toSeatRequestResource);
  }

  @Post('requests/:id/accept')
  @Profiles('driver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept a seat request',
    description:
      'RF-09/RF-10. Takes a seat; the first acceptance confirms the trip.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SeatRequestResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_TRIP_DRIVER'],
    [HttpStatus.NOT_FOUND]: ['REQUEST_NOT_FOUND'],
    [HttpStatus.CONFLICT]: [
      'TRIP_FULL',
      'TRIP_NOT_OPEN',
      'INVALID_REQUEST_TRANSITION',
    ],
  })
  async accept(
    @CurrentUser() driver: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<SeatRequestResource> {
    return toSeatRequestResource(
      await this.requestsService.accept(driver.sub, id),
    );
  }

  @Post('requests/:id/reject')
  @Profiles('driver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a seat request (RF-09)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SeatRequestResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_TRIP_DRIVER'],
    [HttpStatus.NOT_FOUND]: ['REQUEST_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['INVALID_REQUEST_TRANSITION'],
  })
  async reject(
    @CurrentUser() driver: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<SeatRequestResource> {
    return toSeatRequestResource(
      await this.requestsService.reject(driver.sub, id),
    );
  }

  // --- Pasajero o conductor

  @Get('requests/:id')
  @ApiOperation({
    summary: 'Get a seat request',
    description: 'Only its passenger and the driver of the trip can see it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SeatRequestResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['REQUEST_NOT_FOUND'],
  })
  async getOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<SeatRequestResource> {
    return toSeatRequestResource(await this.requestsService.get(user.sub, id));
  }
}
