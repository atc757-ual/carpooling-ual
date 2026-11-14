import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { Public } from '../../shared/auth/public.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  toTripShareLinkResource,
  toTripShareResource,
  TripShareLinkResource,
  TripShareResource,
} from './dto/trip-share.resource';
import { TripSharesService } from './trip-shares.service';

const PASSENGER_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
};

// Compartir el viaje en directo (seguridad del pasajero): el pasajero genera
// o retira el enlace, y quien lo recibe lo abre sin cuenta
@ApiTags('tracking')
@Controller()
export class TripSharesController {
  constructor(private readonly sharesService: TripSharesService) {}

  @Post('trips/:tripId/share')
  @Profiles('passenger')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Share my trip live with someone I trust',
    description:
      'Only an accepted passenger, while the trip is confirmed or in progress. Creates a secret link that opens without an account; a previous active link of the passenger for this trip stops working. The token is returned only once.',
  })
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiCreatedResponse({
    type: TripShareLinkResource,
    headers: { Location: { description: 'Link to the shared trip' } },
  })
  @ApiErrorResponses({
    ...PASSENGER_ERRORS,
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED', 'NOT_TRIP_PASSENGER'],
    [HttpStatus.CONFLICT]: ['SHARE_NOT_ALLOWED'],
  })
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', uuidParam('tripId')) tripId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TripShareLinkResource> {
    const link = toTripShareLinkResource(
      await this.sharesService.create(user.sub, tripId),
    );
    response.setHeader('Location', link.href);
    return link;
  }

  @Delete('trips/:tripId/share')
  @Profiles('passenger')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Stop sharing my trip',
    description:
      'The active link of the passenger for this trip stops working at once. Without an active link it does nothing.',
  })
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'The link no longer works' })
  @ApiErrorResponses({
    ...PASSENGER_ERRORS,
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async revoke(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', uuidParam('tripId')) tripId: string,
  ): Promise<void> {
    await this.sharesService.revoke(user.sub, tripId);
  }

  @Get('shares/:token')
  @Public()
  @ApiOperation({
    summary: 'Follow a shared trip',
    description:
      'Public: whoever has the link. The status, the pickup, the driver first name and the car; the position and the route only while the trip is in progress. Once the trip is over, without the plate; 24 hours later the link stops working.',
  })
  @ApiParam({ name: 'token', description: 'The secret token of the link' })
  @ApiOkResponse({ type: TripShareResource })
  @ApiErrorResponses({ [HttpStatus.NOT_FOUND]: ['SHARE_NOT_FOUND'] })
  async get(@Param('token') token: string): Promise<TripShareResource> {
    return toTripShareResource(await this.sharesService.getByToken(token));
  }
}
