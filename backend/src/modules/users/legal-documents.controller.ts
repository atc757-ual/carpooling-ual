import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { Public } from '../../shared/auth/public.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { allowedParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { ConsentsService } from './consents.service';
import {
  AcceptLegalDocumentDto,
  AdminLegalDocumentResource,
  legalDocumentHref,
  LegalDocumentResource,
  ListLegalDocumentsQueryDto,
  PendingLegalDocumentResource,
  SaveLegalDraftDto,
  toAdminLegalDocumentResource,
  toLegalDocumentResource,
} from './dto/legal-document.resource';
import { LEGAL_DOCUMENT_TYPES } from './entities/legal-document.entity';
import type { LegalDocumentType } from './entities/legal-document.entity';
import { LegalDocumentsService } from './legal-documents.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};
const ADMIN_ERRORS = {
  ...AUTH_ERRORS,
  [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
};
const TYPE_PARAM = { name: 'type', enum: LEGAL_DOCUMENT_TYPES };
const typeParam = () => allowedParam('type', LEGAL_DOCUMENT_TYPES);

// Documentos legales: la versión vigente (sin sesión: se lee al registrarse)
// y las versiones nuevas que cada usuario tiene que aceptar
@ApiTags('legal documents')
@ApiBearerAuth()
@Controller()
export class LegalDocumentsController {
  constructor(
    private readonly documents: LegalDocumentsService,
    private readonly consents: ConsentsService,
  ) {}

  @Public()
  @Get('legal-documents/:type')
  @ApiOperation({ summary: 'Get the current version of a legal document' })
  @ApiParam(TYPE_PARAM)
  @ApiOkResponse({ type: LegalDocumentResource })
  @ApiErrorResponses({
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['LEGAL_DOCUMENT_NOT_FOUND'],
  })
  async getCurrent(
    @Param('type', typeParam()) type: LegalDocumentType,
  ): Promise<LegalDocumentResource> {
    return toLegalDocumentResource(await this.documents.getCurrent(type));
  }

  @Get('users/me/legal-documents/pending')
  @ApiOperation({
    summary: 'List the legal documents I still have to accept',
    description:
      'The current versions I have not accepted (for example after a new one is published). The app asks to accept them before going on.',
  })
  @ApiOkResponse({ type: [PendingLegalDocumentResource] })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND'],
  })
  async listPending(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PendingLegalDocumentResource[]> {
    const pending = await this.consents.pendingDocuments(user.sub);
    return pending.map(({ type, version }) => ({
      type,
      version,
      href: legalDocumentHref(type),
    }));
  }

  @Post('users/me/legal-acceptances')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Accept the current version of a legal document',
    description:
      'Recorded in my consent history (source document_update). Accepting it again changes nothing.',
  })
  @ApiNoContentResponse()
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['USER_NOT_FOUND', 'LEGAL_DOCUMENT_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['LEGAL_DOCUMENT_OUTDATED'],
  })
  async accept(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: AcceptLegalDocumentDto,
  ): Promise<void> {
    await this.consents.acceptDocument(user.sub, body.type, body.version);
  }
}

// Documentos legales en el panel: el historial de versiones y un borrador
// por documento que se edita y se publica. El HTML se sanea al guardarlo
@ApiTags('admin legal documents')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/legal-documents')
export class AdminLegalDocumentsController {
  constructor(private readonly documents: LegalDocumentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List every version of the legal documents',
    description: 'Drafts included, the newest first within each document.',
  })
  @ApiPaginatedResponse(AdminLegalDocumentResource)
  @ApiErrorResponses(ADMIN_ERRORS)
  async list(
    @Query() query: ListLegalDocumentsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminLegalDocumentResource[]> {
    const page = await this.documents.list({ type: query.type }, query);
    setPaginationHeaders(response, page);
    return page.items.map(toAdminLegalDocumentResource);
  }

  @Get(':type/draft')
  @ApiOperation({ summary: 'Get the draft of a legal document' })
  @ApiParam(TYPE_PARAM)
  @ApiOkResponse({ type: AdminLegalDocumentResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.NOT_FOUND]: ['LEGAL_DRAFT_NOT_FOUND'],
  })
  async getDraft(
    @Param('type', typeParam()) type: LegalDocumentType,
  ): Promise<AdminLegalDocumentResource> {
    return toAdminLegalDocumentResource(await this.documents.getDraft(type));
  }

  @Put(':type/draft')
  @ApiOperation({
    summary: 'Create or replace the draft of a legal document',
    description:
      'A new draft takes the next version (1.0 → 1.1). The HTML is sanitized: only headings, paragraphs, lists, bold, italics, line breaks and safe links remain.',
  })
  @ApiParam(TYPE_PARAM)
  @ApiOkResponse({ type: AdminLegalDocumentResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.NOT_FOUND]: ['LEGAL_DOCUMENT_NOT_FOUND'],
  })
  async saveDraft(
    @Param('type', typeParam()) type: LegalDocumentType,
    @Body() body: SaveLegalDraftDto,
  ): Promise<AdminLegalDocumentResource> {
    return toAdminLegalDocumentResource(
      await this.documents.saveDraft(type, body.content),
    );
  }

  @Post(':type/draft/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish the draft of a legal document',
    description:
      'It becomes the current version; every user must accept it the next time they sign in.',
  })
  @ApiParam(TYPE_PARAM)
  @ApiOkResponse({ type: AdminLegalDocumentResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.NOT_FOUND]: ['LEGAL_DRAFT_NOT_FOUND'],
  })
  async publish(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('type', typeParam()) type: LegalDocumentType,
  ): Promise<AdminLegalDocumentResource> {
    return toAdminLegalDocumentResource(
      await this.documents.publish(admin.sub, type),
    );
  }
}
