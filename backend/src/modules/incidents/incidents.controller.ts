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
import { IncidentResource, toIncidentResource } from './dto/incident.resource';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { ReportIncidentDto } from './dto/report-incident.dto';
import { ReviewIncidentDto } from './dto/review-incident.dto';
import { IncidentReviewService } from './incident-review.service';
import { IncidentsService } from './incidents.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Incidencias (RF-23) y su revisión (CU-12). Una incidencia la ven quien la
// registró y los administradores; la lista general y la revisión son solo
// del administrador
@ApiTags('incidents')
@ApiBearerAuth()
@Controller()
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly reviewService: IncidentReviewService,
  ) {}

  // --- Conductor o pasajero del viaje (sin @Profiles: lo decide el service)

  @Post('trips/:tripId/incidents')
  @ApiOperation({
    summary: 'Report an incident and cancel during a trip in progress',
    description:
      'RF-23. If the driver reports it, the trip is cancelled and its accepted passengers get priority (RF-24). If an accepted passenger reports it, only their seat request is cancelled and the trip goes on.',
  })
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiCreatedResponse({
    type: IncidentResource,
    headers: { Location: { description: 'Link to the new incident' } },
  })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['NOT_TRIP_PASSENGER'],
    [HttpStatus.NOT_FOUND]: ['TRIP_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['TRIP_NOT_IN_PROGRESS'],
  })
  async report(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', uuidParam('tripId')) tripId: string,
    @Body() dto: ReportIncidentDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IncidentResource> {
    const incident = toIncidentResource(
      await this.incidentsService.report(user.sub, tripId, dto),
    );
    response.setHeader('Location', incident.href);
    return incident;
  }

  @Get('users/me/incidents')
  @ApiOperation({ summary: 'List the incidents I reported, the newest first' })
  @ApiPaginatedResponse(IncidentResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async listMine(
    @CurrentUser() user: AccessTokenPayload,
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IncidentResource[]> {
    const page = await this.incidentsService.listForReporter(
      user.sub,
      pagination,
    );
    setPaginationHeaders(response, page);
    return page.items.map(toIncidentResource);
  }

  @Get('incidents/:id')
  @ApiOperation({
    summary: 'Get an incident',
    description: 'Only whoever reported it and the administrators can see it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IncidentResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['INCIDENT_NOT_FOUND'],
  })
  async getOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<IncidentResource> {
    const isAdmin = user.profiles.includes('admin');
    return toIncidentResource(
      await this.incidentsService.get(user.sub, isAdmin, id),
    );
  }

  // --- Administrador (CU-12)

  @Get('incidents')
  @Profiles('admin')
  @ApiOperation({
    summary: 'List incidents to review',
    description:
      'CU-12. Filter by status and category; the oldest first. Each one comes with its trip route and driver.',
  })
  @ApiPaginatedResponse(IncidentResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  async list(
    @Query() query: ListIncidentsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IncidentResource[]> {
    const page = await this.incidentsService.list(
      { status: query.status, category: query.category },
      query,
    );
    setPaginationHeaders(response, page);
    return page.items.map(toIncidentResource);
  }

  // --- Revisión del administrador (CU-12): registrada → en revisión → atendida

  @Post('incidents/:id/review/start')
  @Profiles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start reviewing an incident',
    description:
      'CU-12: the administrator takes the incident (open → in_review); the others see who is reviewing it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IncidentResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['INCIDENT_NOT_FOUND'],
    [HttpStatus.CONFLICT]: [
      'INCIDENT_ALREADY_REVIEWED',
      'INCIDENT_REVIEW_TAKEN',
      'INCIDENT_INVALID_TRANSITION',
    ],
  })
  async startReview(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<IncidentResource> {
    return toIncidentResource(await this.reviewService.start(admin.sub, id));
  }

  @Post('incidents/:id/review/release')
  @Profiles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stop reviewing an incident',
    description:
      'CU-12: the administrator who is reviewing it leaves it (in_review → open) for someone else.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IncidentResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['INCIDENT_NOT_FOUND'],
    [HttpStatus.CONFLICT]: [
      'INCIDENT_ALREADY_REVIEWED',
      'INCIDENT_REVIEW_TAKEN',
      'INCIDENT_INVALID_TRANSITION',
    ],
  })
  async releaseReview(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<IncidentResource> {
    return toIncidentResource(await this.reviewService.release(admin.sub, id));
  }

  @Post('incidents/:id/review')
  @Profiles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve an incident',
    description:
      'CU-12: the administrator who is reviewing it closes it with a resolution (in_review → reviewed). Final.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IncidentResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['INCIDENT_NOT_FOUND'],
    [HttpStatus.CONFLICT]: [
      'INCIDENT_ALREADY_REVIEWED',
      'INCIDENT_REVIEW_TAKEN',
      'INCIDENT_INVALID_TRANSITION',
    ],
  })
  async review(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
    @Body() dto: ReviewIncidentDto,
  ): Promise<IncidentResource> {
    return toIncidentResource(
      await this.reviewService.resolve(admin.sub, id, dto.resolution),
    );
  }
}
