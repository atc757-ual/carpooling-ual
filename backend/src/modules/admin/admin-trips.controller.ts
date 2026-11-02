import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { AdminTripsService } from './admin-trips.service';
import {
  AdminTripDetailResource,
  AdminTripRowResource,
  ListAdminTripsQueryDto,
  toAdminTripDetailResource,
  toAdminTripRowResource,
} from './dto/admin-trip.resource';

const ADMIN_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
};

// Viajes en el panel de administración: solo lectura y solo para
// administradores
@ApiTags('admin trips')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/trips')
export class AdminTripsController {
  constructor(private readonly adminTrips: AdminTripsService) {}

  @Get()
  @ApiOperation({
    summary: 'List trips',
    description:
      'The latest departure first. Filter by status, departure days (campus time) and the name or email of the driver. Each trip comes with its pending and accepted requests.',
  })
  @ApiPaginatedResponse(AdminTripRowResource)
  @ApiErrorResponses(ADMIN_ERRORS)
  async list(
    @Query() query: ListAdminTripsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminTripRowResource[]> {
    const page = await this.adminTrips.list(query, query);
    setPaginationHeaders(response, page);
    return page.items.map(toAdminTripRowResource);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a trip with its requests and the timeline of its events',
    description:
      'The requests, priority ones first; the timeline, the events of the trip and its requests in order (without payload).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AdminTripDetailResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
  })
  async get(
    @Param('id', uuidParam('id')) id: string,
  ): Promise<AdminTripDetailResource> {
    return toAdminTripDetailResource(await this.adminTrips.get(id));
  }
}
