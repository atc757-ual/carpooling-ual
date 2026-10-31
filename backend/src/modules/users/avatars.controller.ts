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
import { AvatarsService } from './avatars.service';
import { AvatarResource, toAvatarResource } from './dto/avatar.resource';
import { AVATAR_KEYS } from './travel-preferences';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Catálogo cerrado de avatares SVG para el perfil público
@ApiTags('avatars')
@ApiBearerAuth()
@Controller('avatars')
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the available avatars',
    description: 'The active SVG avatars, in display order.',
  })
  @ApiPaginatedResponse(AvatarResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async list(
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AvatarResource[]> {
    const page = await this.avatarsService.listActive(pagination);
    setPaginationHeaders(response, page);
    return page.items.map(toAvatarResource);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an avatar' })
  @ApiParam({ name: 'id', enum: AVATAR_KEYS, example: 'sun' })
  @ApiOkResponse({ type: AvatarResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.NOT_FOUND]: ['AVATAR_NOT_FOUND'],
  })
  async getOne(@Param('id') id: string): Promise<AvatarResource> {
    return toAvatarResource(await this.avatarsService.getActive(id));
  }
}
