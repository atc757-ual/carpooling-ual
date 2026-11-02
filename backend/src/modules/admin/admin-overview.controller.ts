import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { EventsService } from '../../events/events.service';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { RequestStatsService } from '../requests/request-stats.service';
import { TripStatsService } from '../trips/trip-stats.service';
import {
  EventResource,
  EventSummaryResource,
  ListEventsQueryDto,
  toEventResource,
  toEventSummaryResource,
} from './dto/admin-events.resource';

const ADMIN_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
};

// Resumen en vivo de la plataforma para la pantalla del Gemelo Digital
export class OverviewResource {
  @ApiProperty({ enum: ['PlatformOverview'] })
  '@type': 'PlatformOverview';

  @ApiProperty({ example: 24, description: 'Trips published today' })
  tripsPublishedToday: number;

  @ApiProperty({ example: 8 })
  tripsInProgress: number;

  @ApiProperty({
    example: 60,
    description: 'Seats offered by active trips',
  })
  seatsOffered: number;

  @ApiProperty({
    example: 41,
    description: 'Seats taken in active trips',
  })
  seatsTaken: number;

  @ApiProperty({ example: 12 })
  pendingRequests: number;
}

// Lo que el panel puede mirar de la plataforma mientras llega el Gemelo
// Digital: un resumen en vivo y los eventos (RNF-08). Solo lectura y solo
// para administradores; cada dato lo sirve el módulo dueño de su tabla
@ApiTags('admin overview')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin')
export class AdminOverviewController {
  constructor(
    private readonly tripStats: TripStatsService,
    private readonly requestStats: RequestStatsService,
    private readonly events: EventsService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get the live overview of the platform',
    description:
      'Trips published today (campus time), trips in progress, seats offered and taken in active trips and pending requests.',
  })
  @ApiOkResponse({ type: OverviewResource })
  @ApiErrorResponses(ADMIN_ERRORS)
  async overview(): Promise<OverviewResource> {
    const [trips, pendingRequests] = await Promise.all([
      this.tripStats.overview(),
      this.requestStats.countPending(),
    ]);
    return {
      '@type': 'PlatformOverview',
      tripsPublishedToday: trips.publishedToday,
      tripsInProgress: trips.inProgress,
      seatsOffered: trips.seatsOffered,
      seatsTaken: trips.seatsTaken,
      pendingRequests,
    };
  }

  @Get('events')
  @ApiOperation({
    summary: 'List the latest events',
    description:
      'The most recent first, optionally of one type. Without the payload: see the detail.',
  })
  @ApiPaginatedResponse(EventSummaryResource)
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async listEvents(
    @Query() query: ListEventsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EventSummaryResource[]> {
    const page = await this.events.list({ type: query.type }, query);
    setPaginationHeaders(response, page);
    return page.items.map(toEventSummaryResource);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get an event with its payload' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EventResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['EVENT_NOT_FOUND'],
  })
  async getEvent(
    @Param('id', uuidParam('id')) id: string,
  ): Promise<EventResource> {
    return toEventResource(await this.events.get(id));
  }
}
