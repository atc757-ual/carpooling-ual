import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import {
  DriverRatingResource,
  DriverReviewResource,
  toDriverRatingResource,
  toDriverReviewResource,
} from './dto/driver-review.resource';
import { DriverReviewsService } from './driver-reviews.service';

const ERRORS = {
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND'],
};

// Reputación de un conductor para quien busca viaje (RF-22)
@ApiTags('reputation')
@ApiBearerAuth()
@Controller('users/:id')
export class DriverReviewsController {
  constructor(private readonly driverReviewsService: DriverReviewsService) {}

  @Get('driver-reviews')
  @ApiOperation({
    summary: "List a driver's published reviews",
    description:
      'RF-22: published reviews the user received as a driver, newest first. The author shows only the first name and the initial of the surname.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiPaginatedResponse(DriverReviewResource)
  @ApiErrorResponses(ERRORS)
  async list(
    @Param('id', uuidParam('id')) userId: string,
    @Query() query: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DriverReviewResource[]> {
    const page = await this.driverReviewsService.list(userId, query);
    setPaginationHeaders(response, page);
    return page.items.map(toDriverReviewResource);
  }

  @Get('driver-rating')
  @ApiOperation({
    summary: "Get a driver's rating summary",
    description:
      'RF-22: average, number of published reviews as a driver and how many there are per star.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DriverRatingResource })
  @ApiErrorResponses(ERRORS)
  async getRating(
    @Param('id', uuidParam('id')) userId: string,
  ): Promise<DriverRatingResource> {
    const view = await this.driverReviewsService.getRating(userId);
    return toDriverRatingResource(view);
  }
}
