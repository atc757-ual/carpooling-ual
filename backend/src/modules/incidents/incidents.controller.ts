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
  constructor(private readonly incidentsService: IncidentsService) {}

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
    description: 'CU-12. Filter by status; the oldest first.',
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
    const page = await this.incidentsService.list(query.status, query);
    setPaginationHeaders(response, page);
    return page.items.map(toIncidentResource);
  }

  @Post('incidents/:id/review')
  @Profiles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Review an incident',
    description:
      'CU-12: the incident is reviewed and closed with a resolution. Final: it cannot be reviewed again.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IncidentResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
    [HttpStatus.NOT_FOUND]: ['INCIDENT_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['INCIDENT_ALREADY_REVIEWED'],
  })
  async review(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
    @Body() dto: ReviewIncidentDto,
  ): Promise<IncidentResource> {
    return toIncidentResource(
      await this.incidentsService.review(admin.sub, id, dto.resolution),
    );
  }
}
