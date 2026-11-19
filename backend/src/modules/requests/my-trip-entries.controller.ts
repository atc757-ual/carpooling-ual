import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { TripsTabQueryDto } from '../../shared/pagination/trips-tab-query.dto';
import {
  toTripEntryResource,
  TripEntryResource,
} from './dto/trip-entry.resource';
import { MyTripEntriesService } from './my-trip-entries.service';

// «Tus viajes»: los que conduce y sus solicitudes de pasajero, en una sola
// lista por pestañas y páginas
@ApiTags('seat requests')
@ApiBearerAuth()
@Controller()
export class MyTripEntriesController {
  constructor(private readonly entries: MyTripEntriesService) {}

  @Get('users/me/trip-entries')
  @ApiOperation({
    summary: 'List my trips as a driver and my seat requests together',
    description:
      "One page of a «My trips» tab, ordered by the trip's departure: upcoming (trips not finished and pending or accepted requests, the soonest first), past (finished trips and completed requests) or cancelled (cancelled or expired trips and rejected, expired or cancelled requests), the latest first. Without tab, upcoming.",
  })
  @ApiPaginatedResponse(TripEntryResource)
  @ApiErrorResponses({
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async listMine(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: TripsTabQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TripEntryResource[]> {
    const page = await this.entries.list(user.sub, {
      tab: query.tab ?? 'upcoming',
      page: query,
    });
    setPaginationHeaders(response, page);
    return page.items.map((entry) => toTripEntryResource(entry, user.sub));
  }
}
