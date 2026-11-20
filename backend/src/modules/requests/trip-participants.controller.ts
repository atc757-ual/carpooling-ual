import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import {
  CoPassengerResource,
  toCoPassengerResource,
} from './dto/co-passenger.resource';
import {
  ParticipantProfileResource,
  toParticipantProfileResource,
} from './dto/participant-profile.resource';
import { TripParticipantsService } from './trip-participants.service';

// Con quién se viaja: el perfil de la otra parte del viaje
@ApiTags('seat requests')
@ApiBearerAuth()
@Controller()
export class TripParticipantsController {
  constructor(private readonly participants: TripParticipantsService) {}

  @Get('trips/:tripId/participants')
  @ApiOperation({
    summary: 'List my co-passengers',
    description:
      'For a passenger with a seat (accepted or dropped off): the other passengers with a seat on the same trip, first name and avatar only. Their profiles cannot be opened.',
  })
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiPaginatedResponse(CoPassengerResource)
  @ApiErrorResponses({
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PARTICIPANT_PROFILE_FORBIDDEN'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
  })
  async listCoPassengers(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', uuidParam('tripId')) tripId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CoPassengerResource[]> {
    const page = await this.participants.listCoPassengers(
      user.sub,
      tripId,
      query,
    );
    setPaginationHeaders(response, page);
    return page.items.map(toCoPassengerResource);
  }

  @Get('trips/:tripId/participants/:userId')
  @ApiOperation({
    summary: 'Get the profile of whom I travel with',
    description:
      'The driver sees each passenger who had a seat (accepted, dropped off or cancelled after being accepted) and each of them sees the driver, in every trip status; passengers do not see each other. Full name, email, "About me", preferences and ratings (not the phone: calls go through the in-progress trip contacts).',
  })
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({ type: ParticipantProfileResource })
  @ApiErrorResponses({
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PARTICIPANT_PROFILE_FORBIDDEN'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND', 'USER_NOT_FOUND'],
  })
  async getProfile(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', uuidParam('tripId')) tripId: string,
    @Param('userId', uuidParam('userId')) userId: string,
  ): Promise<ParticipantProfileResource> {
    return toParticipantProfileResource(
      await this.participants.getProfile(user.sub, { tripId, userId }),
    );
  }
}
