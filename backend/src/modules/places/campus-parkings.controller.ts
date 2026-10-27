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
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { CampusParkingsService } from './campus-parkings.service';
import {
  CampusParkingResource,
  toCampusParkingResource,
} from './dto/campus-parking.resource';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Parkings del campus (destino de los viajes al campus). Para cualquier
// usuario con sesión, con o sin perfil
@ApiTags('campus-parkings')
@ApiBearerAuth()
@Controller('campus-parkings')
export class CampusParkingsController {
  constructor(private readonly parkingsService: CampusParkingsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the campus parkings',
    description: 'The active campus parkings, in display order.',
  })
  @ApiPaginatedResponse(CampusParkingResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async list(
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CampusParkingResource[]> {
    const page = await this.parkingsService.listActive(pagination);
    setPaginationHeaders(response, page);
    return page.items.map(toCampusParkingResource);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campus parking' })
  @ApiParam({ name: 'id', example: 'p1' })
  @ApiOkResponse({ type: CampusParkingResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.NOT_FOUND]: ['CAMPUS_PARKING_NOT_FOUND'],
  })
  async getOne(@Param('id') id: string): Promise<CampusParkingResource> {
    return toCampusParkingResource(await this.parkingsService.getActive(id));
  }
}
