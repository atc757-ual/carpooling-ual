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
import {
  AdminVehicleBrandResource,
  CreateVehicleBrandDto,
  MoveVehicleBrandDto,
  toAdminVehicleBrandResource,
  toVehicleBrandResource,
  UpdateVehicleBrandDto,
  VehicleBrandResource,
} from './dto/vehicle-brand.resource';
import { VehicleBrandsService } from './vehicle-brands.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
};
const ADMIN_ERRORS = {
  ...AUTH_ERRORS,
  [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
};
const KEY_PARAM = { name: 'key', example: 'alfa-romeo' };

// Marcas de coche que sugiere el formulario del vehículo: las activas, para
// cualquier usuario con sesión
@ApiTags('catalogs')
@ApiBearerAuth()
@Controller('catalogs/vehicle-brands')
export class VehicleBrandsController {
  constructor(private readonly brands: VehicleBrandsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the vehicle brands',
    description: 'The active brands, in display order.',
  })
  @ApiPaginatedResponse(VehicleBrandResource)
  @ApiErrorResponses(AUTH_ERRORS)
  async list(
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<VehicleBrandResource[]> {
    const page = await this.brands.listActive(pagination);
    setPaginationHeaders(response, page);
    return page.items.map(toVehicleBrandResource);
  }
}

// Marcas en el panel: todas, con alta, edición, activar o desactivar y orden.
// Nunca se borra una marca: se desactiva
@ApiTags('admin catalogs')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/catalogs/vehicle-brands')
export class AdminVehicleBrandsController {
  constructor(private readonly brands: VehicleBrandsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all the vehicle brands',
    description: 'Active or not, in display order.',
  })
  @ApiPaginatedResponse(AdminVehicleBrandResource)
  @ApiErrorResponses(ADMIN_ERRORS)
  async list(
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminVehicleBrandResource[]> {
    const page = await this.brands.listAll(pagination);
    setPaginationHeaders(response, page);
    return page.items.map(toAdminVehicleBrandResource);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a vehicle brand',
    description:
      'At the end of the list. Its key comes from the name (no accents, lower case, hyphens) and never changes.',
  })
  @ApiCreatedResponse({ type: AdminVehicleBrandResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.CONFLICT]: ['CATALOG_ITEM_EXISTS'],
  })
  async create(
    @CurrentUser() admin: AccessTokenPayload,
    @Body() body: CreateVehicleBrandDto,
  ): Promise<AdminVehicleBrandResource> {
    return toAdminVehicleBrandResource(
      await this.brands.create(admin.sub, body.name),
    );
  }

  @Patch(':key')
  @ApiOperation({
    summary: 'Rename a vehicle brand or change whether it is offered',
  })
  @ApiParam(KEY_PARAM)
  @ApiOkResponse({ type: AdminVehicleBrandResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.NOT_FOUND]: ['CATALOG_ITEM_NOT_FOUND'],
  })
  async update(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('key') key: string,
    @Body() body: UpdateVehicleBrandDto,
  ): Promise<AdminVehicleBrandResource> {
    return toAdminVehicleBrandResource(
      await this.brands.update(admin.sub, key, body),
    );
  }

  @Post(':key/move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Move a vehicle brand one place up or down',
    description: 'At either end nothing changes.',
  })
  @ApiParam(KEY_PARAM)
  @ApiOkResponse({ type: AdminVehicleBrandResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.NOT_FOUND]: ['CATALOG_ITEM_NOT_FOUND'],
  })
  async move(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('key') key: string,
    @Body() body: MoveVehicleBrandDto,
  ): Promise<AdminVehicleBrandResource> {
    return toAdminVehicleBrandResource(
      await this.brands.move(admin.sub, key, body.direction),
    );
  }
}
