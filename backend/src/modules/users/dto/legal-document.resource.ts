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
  LEGAL_CHANGE_TYPES,
  LEGAL_DOCUMENT_STATUSES,
  LEGAL_DOCUMENT_TYPES,
  LegalDocument,
  SIGNUP_DOCUMENT_TYPES,
} from '../entities/legal-document.entity';
import type {
  LegalChangeType,
  LegalDocumentType,
  SignupDocumentType,
} from '../entities/legal-document.entity';

// Un documento legal hasta ~200 KB de HTML
const MAX_CONTENT_LENGTH = 200_000;
// «Qué ha cambiado»: unas líneas
const MAX_SUMMARY_LENGTH = 1000;

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

  @ApiProperty({
    enum: LEGAL_CHANGE_TYPES,
    description:
      'major: users must accept it again; minor: they are only told about it',
  })
  changeType: LegalChangeType;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'What changed, shown above the document',
    example: 'Añadimos cómo usamos tu ubicación durante el viaje.',
  })
  summary: string | null;

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

  @ApiPropertyOptional({
    enum: LEGAL_CHANGE_TYPES,
    default: 'minor',
    description:
      'major raises the major version (1.4 → 2.0) and asks every user to accept it again; minor raises the minor one (1.4 → 1.5)',
  })
  @IsOptional()
  @IsIn(LEGAL_CHANGE_TYPES)
  changeType?: LegalChangeType;

  @ApiPropertyOptional({
    maxLength: MAX_SUMMARY_LENGTH,
    description: 'What changed; required to publish',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SUMMARY_LENGTH)
  summary?: string;
}

// Solo las condiciones y la política (la declaración del conductor se acepta
// en PUT /api/users/me/driver-declaration)
export class AcceptLegalDocumentDto {
  @ApiProperty({ enum: SIGNUP_DOCUMENT_TYPES })
  @IsIn(SIGNUP_DOCUMENT_TYPES)
  type: SignupDocumentType;

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
    changeType: document.changeType,
    summary: document.summary,
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
