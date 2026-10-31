import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { SearchTripsDto } from './dto/search-trips.dto';
import {
  toTripMatchResource,
  TripMatchResource,
} from './dto/trip-match.resource';
import { MatchingService } from './matching.service';

// Búsqueda de viajes del pasajero (RF-06, RF-07). Es POST porque lleva un
// punto GeoJSON; no crea nada, así que responde 200
@ApiTags('matching')
@ApiBearerAuth()
@Controller('trips')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @Profiles('passenger')
  @ApiOperation({
    summary: 'Search compatible trips',
    description:
      'Published trips going the same way, near the address and the campus parking, with enough seats, an acceptable detour for the driver and a time within the margin. Sorted by compatibility (60 % detour, 40 % time); at most 10.',
  })
  @ApiPaginatedResponse(TripMatchResource)
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['CAMPUS_PARKING_NOT_FOUND'],
  })
  async search(
    @CurrentUser() passenger: AccessTokenPayload,
    @Body() search: SearchTripsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TripMatchResource[]> {
    const matches = await this.matchingService.search(passenger.sub, search);
    setPaginationHeaders(response, { items: matches, total: matches.length });
    return matches.map(toTripMatchResource);
  }
}
