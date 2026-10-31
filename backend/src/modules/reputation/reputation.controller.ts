import {
  Body,
  Controller,
  Get,
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
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import {
  PendingReviewTripResource,
  toPendingReviewTripResource,
} from './dto/pending-review.resource';
import { ReviewResource, toReviewResource } from './dto/review.resource';
import { ReputationService } from './reputation.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Reseñas y reputación por rol (RF-22): doble ciego con plazo de 7 días
@ApiTags('reputation')
@ApiBearerAuth()
@Controller()
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Post('trips/:tripId/reviews')
  @ApiOperation({
    summary: 'Review a participant of a finished trip',
    description:
      'RF-22: after a trip finishes, the driver can review each accepted passenger and each accepted passenger can review the driver within 7 days. Double-blind: the review is published once the other side also reviews or when the 7-day window closes.',
  })
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiCreatedResponse({ type: ReviewResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['REVIEW_NOT_ALLOWED'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['REVIEW_WINDOW_CLOSED', 'REVIEW_ALREADY_EXISTS'],
  })
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', uuidParam('tripId')) tripId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResource> {
    const view = await this.reputationService.createReview(
      user.sub,
      tripId,
      dto,
    );
    return toReviewResource(view);
  }

  @Get('users/me/reviews')
  @ApiOperation({
    summary: 'List my reviews (received or given)',
    description:
      'RF-22: received returns only published reviews targeting me (newest publication first); given returns all reviews I authored (newest creation first). Optional role filters by target role (driver or passenger). Expired unpublished reviews are published before querying.',
  })
  @ApiPaginatedResponse(ReviewResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async listMine(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListReviewsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReviewResource[]> {
    const page = await this.reputationService.listForUser(
      user.sub,
      { direction: query.direction, role: query.role },
      query,
    );
    setPaginationHeaders(response, page);
    return page.items.map(toReviewResource);
  }

  @Get('users/me/pending-reviews')
  @ApiOperation({
    summary: 'List finished trips I can still review',
    description:
      'RF-22: finished trips within the 7-day window where I participated as driver or accepted passenger and still have at least one participant left to review.',
  })
  @ApiOkResponse({ type: [PendingReviewTripResource] })
  @ApiErrorResponses(AUTH_ERRORS)
  async listPending(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PendingReviewTripResource[]> {
    const pending = await this.reputationService.listPendingForUser(user.sub);
    return pending.map(toPendingReviewTripResource);
  }
}

