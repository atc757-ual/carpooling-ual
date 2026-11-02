import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { MoveCatalogItemDto } from '../catalogs/dto/catalog-item.dto';
import { CampusParkingsService } from '../places/campus-parkings.service';
import { AdminParkingsService } from './admin-parkings.service';
import {
  AdminParkingResource,
  CreateParkingDto,
  toAdminParkingResource,
  toGeoPoint,
  UpdateParkingDto,
} from './dto/admin-parking.dto';

const ADMIN_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
};
const ID_PARAM = { name: 'id', example: 'p1' };

// Parkings del campus en el panel (catálogos): todos, con alta, cambio de
// nombre o de sitio, abrir o cerrar y orden. Nunca se borra un parking
@ApiTags('admin catalogs')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/catalogs/campus-parkings')
export class AdminParkingsController {
  constructor(
    private readonly parkings: CampusParkingsService,
    private readonly adminParkings: AdminParkingsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all the campus parkings',
    description: 'Open or closed, in display order.',
  })
  @ApiPaginatedResponse(AdminParkingResource)
  @ApiErrorResponses(ADMIN_ERRORS)
  async list(
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminParkingResource[]> {
    const page = await this.parkings.listAll(pagination);
    setPaginationHeaders(response, page);
    return page.items.map(toAdminParkingResource);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a campus parking',
    description:
      'At the end of the list, with the next id (p6, p7…). Its point must be inside the service area.',
  })
  @ApiCreatedResponse({ type: AdminParkingResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.BAD_REQUEST]: [
      'VALIDATION_FAILED',
      'PARKING_OUTSIDE_SERVICE_AREA',
    ],
  })
  async create(
    @CurrentUser() admin: AccessTokenPayload,
    @Body() body: CreateParkingDto,
  ): Promise<AdminParkingResource> {
    const parking = await this.parkings.create(admin.sub, {
      name: body.name,
      point: toGeoPoint(body.location),
    });
    return toAdminParkingResource(parking);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Rename, move, open or close a campus parking',
    description:
      'Only what is sent changes. While it has published, confirmed or in progress trips it cannot be closed or moved (the name can change).',
  })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ type: AdminParkingResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.BAD_REQUEST]: [
      'VALIDATION_FAILED',
      'PARKING_OUTSIDE_SERVICE_AREA',
    ],
    [HttpStatus.NOT_FOUND]: ['CAMPUS_PARKING_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['PARKING_IN_USE'],
  })
  async update(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: UpdateParkingDto,
  ): Promise<AdminParkingResource> {
    const parking = await this.adminParkings.update(admin.sub, id, {
      name: body.name,
      isActive: body.isActive,
      point: body.location ? toGeoPoint(body.location) : undefined,
    });
    return toAdminParkingResource(parking);
  }

  @Post(':id/move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Move a campus parking one place up or down',
    description: 'At either end nothing changes.',
  })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ type: AdminParkingResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.NOT_FOUND]: ['CAMPUS_PARKING_NOT_FOUND'],
  })
  async move(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: MoveCatalogItemDto,
  ): Promise<AdminParkingResource> {
    return toAdminParkingResource(
      await this.parkings.move(admin.sub, id, body.direction),
    );
  }
}
