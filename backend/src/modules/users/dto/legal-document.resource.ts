import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { API_PREFIX } from '../../../app.setup';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';
import {
  LEGAL_DOCUMENT_STATUSES,
  LEGAL_DOCUMENT_TYPES,
  LegalDocument,
} from '../entities/legal-document.entity';
import type { LegalDocumentType } from '../entities/legal-document.entity';

// Un documento legal hasta ~200 KB de HTML
const MAX_CONTENT_LENGTH = 200_000;

// La versión vigente de un documento, como la ve la app
export class LegalDocumentResource {
  @ApiProperty({ enum: ['LegalDocument'] })
  '@type': 'LegalDocument';

  @ApiProperty({ example: '/api/legal-documents/privacy' })
  href: string;

  @ApiProperty({ enum: LEGAL_DOCUMENT_TYPES })
  type: LegalDocumentType;

  @ApiProperty({ example: '1.1' })
  version: string;

  @ApiProperty({
    description:
      'Sanitized HTML: h2, h3, p, ul, ol, li, strong, b, em, i, br and links (http, https or mailto)',
    example: '<h2>1. Qué es UAL Carpool</h2><p>…</p>',
  })
  content: string;

  @ApiProperty({ format: 'date-time', type: String, nullable: true })
  publishedAt: string | null;
}

// En el panel: cada versión, con los borradores
export class AdminLegalDocumentResource extends LegalDocumentResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: LEGAL_DOCUMENT_STATUSES })
  status: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

// Un documento que el usuario tiene que aceptar
export class PendingLegalDocumentResource {
  @ApiProperty({ enum: LEGAL_DOCUMENT_TYPES })
  type: LegalDocumentType;

  @ApiProperty({ example: '1.1' })
  version: string;

  @ApiProperty({ example: '/api/legal-documents/terms' })
  href: string;
}

export class ListLegalDocumentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LEGAL_DOCUMENT_TYPES })
  @IsOptional()
  @IsIn(LEGAL_DOCUMENT_TYPES)
  type?: LegalDocumentType;
}

export class SaveLegalDraftDto {
  @ApiProperty({
    maxLength: MAX_CONTENT_LENGTH,
    description: 'HTML; it is sanitized before saving',
    example: '<h2>1. Qué es UAL Carpool</h2><p>…</p>',
  })
  @IsString()
  @MaxLength(MAX_CONTENT_LENGTH)
  @Matches(/\S/)
  content: string;
}

export class AcceptLegalDocumentDto {
  @ApiProperty({ enum: LEGAL_DOCUMENT_TYPES })
  @IsIn(LEGAL_DOCUMENT_TYPES)
  type: LegalDocumentType;

  @ApiProperty({ example: '1.1', description: 'The version the user read' })
  @Matches(/^\d+\.\d+$/)
  version: string;
}

export function legalDocumentHref(type: LegalDocumentType): string {
  return `/${API_PREFIX}/legal-documents/${type}`;
}

export function toLegalDocumentResource(
  document: LegalDocument,
): LegalDocumentResource {
  return {
    '@type': 'LegalDocument',
    href: legalDocumentHref(document.type),
    type: document.type,
    version: document.version,
    content: document.content,
    publishedAt: document.publishedAt?.toISOString() ?? null,
  };
}

export function toAdminLegalDocumentResource(
  document: LegalDocument,
): AdminLegalDocumentResource {
  return {
    ...toLegalDocumentResource(document),
    id: document.id,
    status: document.status,
    updatedAt: document.updatedAt.toISOString(),
  };
}
