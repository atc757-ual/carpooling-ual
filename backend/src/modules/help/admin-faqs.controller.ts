import {
  applyDecorators,
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
import type { ApiErrors } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { AdminFaqTopicsService } from './admin-faq-topics.service';
import { AdminFaqsService } from './admin-faqs.service';
import {
  AdminFaqQueryDto,
  CreateFaqDto,
  MoveFaqDto,
  UpdateFaqDto,
  UpdateFaqTopicDto,
} from './dto/admin-faq.dto';
import {
  AdminFaqResource,
  AdminFaqTopicResource,
  toAdminFaqResource,
  toAdminFaqTopicResource,
} from './dto/admin-faq.resource';

const ADMIN_ERRORS: ApiErrors = {
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
};

// Lo común de las rutas que cambian una pregunta: su id, el recurso de
// vuelta y sus errores (los del panel, que no exista y los propios)
function FaqChange(summary: string, errors: ApiErrors = {}): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiParam({ name: 'id', format: 'uuid' }),
    ApiOkResponse({ type: AdminFaqResource }),
    ApiErrorResponses({
      ...ADMIN_ERRORS,
      [HttpStatus.NOT_FOUND]: ['FAQ_NOT_FOUND'],
      ...errors,
    }),
  );
}

function FaqTopicChange(summary: string): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiParam({ name: 'key', example: 'cancellations' }),
    ApiOkResponse({ type: AdminFaqTopicResource }),
    ApiErrorResponses({
      ...ADMIN_ERRORS,
      [HttpStatus.NOT_FOUND]: ['FAQ_TOPIC_NOT_FOUND'],
    }),
  );
}

// Preguntas frecuentes en el panel de administración
@ApiTags('admin help')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/faqs')
export class AdminFaqsController {
  constructor(private readonly faqs: AdminFaqsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all the FAQs',
    description: 'Published or not, in topic order, with both languages.',
  })
  @ApiPaginatedResponse(AdminFaqResource)
  @ApiErrorResponses(ADMIN_ERRORS)
  async list(
    @Query() query: AdminFaqQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminFaqResource[]> {
    const page = await this.faqs.list(query, query);
    setPaginationHeaders(response, page);
    return page.items.map(toAdminFaqResource);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a FAQ',
    description: 'As a draft, at the end of its topic.',
  })
  @ApiCreatedResponse({ type: AdminFaqResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.NOT_FOUND]: ['FAQ_TOPIC_NOT_FOUND'],
  })
  async create(
    @CurrentUser() admin: AccessTokenPayload,
    @Body() body: CreateFaqDto,
  ): Promise<AdminFaqResource> {
    return toAdminFaqResource(await this.faqs.create(admin.sub, body));
  }

  @Patch(':id')
  @FaqChange('Change a FAQ: only what is sent changes', {
    [HttpStatus.NOT_FOUND]: ['FAQ_NOT_FOUND', 'FAQ_TOPIC_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['FAQ_TRANSLATION_MISSING'],
  })
  async update(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
    @Body() body: UpdateFaqDto,
  ): Promise<AdminFaqResource> {
    return toAdminFaqResource(await this.faqs.update(admin.sub, id, body));
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @FaqChange('Publish a draft FAQ, complete in both languages', {
    [HttpStatus.CONFLICT]: [
      'INVALID_FAQ_TRANSITION',
      'FAQ_TRANSLATION_MISSING',
    ],
  })
  async publish(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<AdminFaqResource> {
    return toAdminFaqResource(
      await this.faqs.changeStatus(admin.sub, id, 'published'),
    );
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @FaqChange('Take a published FAQ back to draft', {
    [HttpStatus.CONFLICT]: ['INVALID_FAQ_TRANSITION'],
  })
  async unpublish(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<AdminFaqResource> {
    return toAdminFaqResource(
      await this.faqs.changeStatus(admin.sub, id, 'draft'),
    );
  }

  @Post(':id/move')
  @HttpCode(HttpStatus.OK)
  @FaqChange('Move a FAQ one place up or down within its topic')
  async move(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
    @Body() body: MoveFaqDto,
  ): Promise<AdminFaqResource> {
    return toAdminFaqResource(
      await this.faqs.move(admin.sub, id, body.direction),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a draft FAQ' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.NOT_FOUND]: ['FAQ_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['FAQ_PUBLISHED_NOT_DELETABLE'],
  })
  async remove(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<void> {
    await this.faqs.remove(admin.sub, id);
  }
}

// Temas del centro de ayuda en el panel: fijos; se cambian y se ordenan
@ApiTags('admin help')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/faq-topics')
export class AdminFaqTopicsController {
  constructor(private readonly topics: AdminFaqTopicsService) {}

  @Get()
  @ApiOperation({ summary: 'List the FAQ topics with both names' })
  @ApiOkResponse({ type: [AdminFaqTopicResource] })
  @ApiErrorResponses(ADMIN_ERRORS)
  async list(): Promise<AdminFaqTopicResource[]> {
    return (await this.topics.list()).map(toAdminFaqTopicResource);
  }

  @Patch(':key')
  @FaqTopicChange('Change the names or the icon of a FAQ topic')
  async update(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('key') key: string,
    @Body() body: UpdateFaqTopicDto,
  ): Promise<AdminFaqTopicResource> {
    return toAdminFaqTopicResource(
      await this.topics.update(admin.sub, key, body),
    );
  }

  @Post(':key/move')
  @HttpCode(HttpStatus.OK)
  @FaqTopicChange('Move a FAQ topic one place up or down')
  async move(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('key') key: string,
    @Body() body: MoveFaqDto,
  ): Promise<AdminFaqTopicResource> {
    return toAdminFaqTopicResource(
      await this.topics.move(admin.sub, key, body.direction),
    );
  }
}
