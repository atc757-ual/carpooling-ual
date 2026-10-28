import {
  Body,
  Controller,
  Delete,
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
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { RegisterVehicleDto } from './dto/register-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { toVehicleResource, VehicleResource } from './dto/vehicle.resource';
import { VehiclesService } from './vehicles.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
};

// Vehículos del conductor autenticado (RF-21). Solo con el perfil de
// conductor, y cada uno solo ve y gestiona los suyos
@ApiTags('vehicles')
@ApiBearerAuth()
@Profiles('driver')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({
    summary: 'Register a vehicle',
    description:
      'Registers a vehicle of the authenticated driver. Registering again a plate the driver had deactivated reactivates it.',
  })
  @ApiCreatedResponse({
    type: VehicleResource,
    headers: { Location: { description: 'Link to the new vehicle' } },
  })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.CONFLICT]: ['VEHICLE_ALREADY_REGISTERED'],
  })
  async register(
    @CurrentUser() driver: AccessTokenPayload,
    @Body() dto: RegisterVehicleDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<VehicleResource> {
    const vehicle = toVehicleResource(
      await this.vehiclesService.register(driver.sub, dto),
    );
    response.setHeader('Location', vehicle.href);
    return vehicle;
  }

  @Get()
  @ApiOperation({ summary: 'List my active vehicles' })
  @ApiPaginatedResponse(VehicleResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async list(
    @CurrentUser() driver: AccessTokenPayload,
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<VehicleResource[]> {
    const page = await this.vehiclesService.listByDriver(
      driver.sub,
      pagination,
    );
    setPaginationHeaders(response, page);
    return page.items.map(toVehicleResource);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of my vehicles' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VehicleResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['VEHICLE_NOT_FOUND'],
  })
  async getOne(
    @CurrentUser() driver: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<VehicleResource> {
    return toVehicleResource(await this.vehiclesService.getOwn(driver.sub, id));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit one of my vehicles',
    description:
      'Changes the make and model and/or the seats; the plate cannot change. The seats cannot change while the vehicle is on a trip, and published trips keep the seats they offered.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VehicleResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['VEHICLE_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['VEHICLE_IN_USE'],
  })
  async update(
    @CurrentUser() driver: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
    @Body() changes: UpdateVehicleDto,
  ): Promise<VehicleResource> {
    return toVehicleResource(
      await this.vehiclesService.update(driver.sub, id, changes),
    );
  }

  // Baja: el vehículo pasa a inactive (los viajes pasados lo conservan)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate one of my vehicles',
    description:
      'The vehicle can no longer be used in new trips, but past trips keep it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Vehicle deactivated' })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['VEHICLE_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['VEHICLE_IN_USE'],
  })
  async deactivate(
    @CurrentUser() driver: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<void> {
    await this.vehiclesService.deactivate(driver.sub, id);
  }
}
