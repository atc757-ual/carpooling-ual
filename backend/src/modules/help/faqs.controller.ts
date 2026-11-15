import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../shared/auth/public.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { FaqLangQueryDto, FaqQueryDto } from './dto/faq-query.dto';
import {
  FaqResource,
  FaqTopicResource,
  toFaqResource,
  toFaqTopicResource,
} from './dto/faq.resource';
import { FaqsService } from './faqs.service';

const VALIDATION_ERRORS = { [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'] };

// Preguntas frecuentes para la app. Sin sesión: son textos de ayuda, sin
// datos de nadie, y también los lee quien aún no tiene cuenta
@ApiTags('help')
@Public()
@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the published FAQs',
    description:
      'In topic order, in the language asked for. Filter by quick-question screen, audience or topic, or search by text.',
  })
  @ApiPaginatedResponse(FaqResource)
  @ApiErrorResponses(VALIDATION_ERRORS)
  async list(
    @Query() query: FaqQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FaqResource[]> {
    const page = await this.faqs.listPublished(query, query);
    setPaginationHeaders(response, page);
    return page.items.map((faq) => toFaqResource(faq, query.lang));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a published FAQ' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FaqResource })
  @ApiErrorResponses({
    ...VALIDATION_ERRORS,
    [HttpStatus.NOT_FOUND]: ['FAQ_NOT_FOUND'],
  })
  async get(
    @Param('id', uuidParam('id')) id: string,
    @Query() query: FaqLangQueryDto,
  ): Promise<FaqResource> {
    return toFaqResource(await this.faqs.getPublished(id), query.lang);
  }
}

// Temas del centro de ayuda: son pocos, así que van todos, sin paginar
@ApiTags('help')
@Public()
@Controller('faq-topics')
export class FaqTopicsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the FAQ topics',
    description: 'All of them in display order, in the language asked for.',
  })
  @ApiOkResponse({ type: [FaqTopicResource] })
  @ApiErrorResponses(VALIDATION_ERRORS)
  async list(@Query() query: FaqLangQueryDto): Promise<FaqTopicResource[]> {
    const topics = await this.faqs.listTopics();
    return topics.map((topic) => toFaqTopicResource(topic, query.lang));
  }
}
