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
  LEGAL_LANGS,
  LegalDocument,
  SIGNUP_DOCUMENT_TYPES,
} from '../entities/legal-document.entity';
import type {
  LegalChangeType,
  LegalDocumentType,
  LegalLang,
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
    enum: LEGAL_LANGS,
    description:
      'Language of content and summary: the one asked for, or es when there is no English translation (the Spanish text is the binding one)',
  })
  lang: LegalLang;

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

// En el panel: cada versión, con los borradores y los dos idiomas (content
// y summary, en español)
export class AdminLegalDocumentResource extends LegalDocumentResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'English translation of content; required to publish',
  })
  contentEn: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'English translation of summary; required to publish',
  })
  summaryEn: string | null;

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

// ?lang= al leer un documento: en qué idioma se devuelve
export class LegalLangQueryDto {
  @ApiPropertyOptional({ enum: LEGAL_LANGS, default: 'es' })
  @IsIn(LEGAL_LANGS)
  lang: LegalLang = 'es';
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

  @ApiPropertyOptional({
    maxLength: MAX_CONTENT_LENGTH,
    description:
      'The English translation, HTML; sanitized before saving. Required to publish',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTENT_LENGTH)
  contentEn?: string;

  @ApiPropertyOptional({
    maxLength: MAX_SUMMARY_LENGTH,
    description: 'What changed, in English; required to publish',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SUMMARY_LENGTH)
  summaryEn?: string;
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

// En inglés solo si está traducido; si no, el texto español (y lang: es)
export function toLegalDocumentResource(
  document: LegalDocument,
  lang: LegalLang = 'es',
): LegalDocumentResource {
  const isEnglish = lang === 'en' && document.contentEn !== null;
  return {
    '@type': 'LegalDocument',
    href: legalDocumentHref(document.type),
    type: document.type,
    version: document.version,
    lang: isEnglish ? 'en' : 'es',
    content: isEnglish ? (document.contentEn ?? '') : document.content,
    changeType: document.changeType,
    summary: isEnglish
      ? (document.summaryEn ?? document.summary)
      : document.summary,
    publishedAt: document.publishedAt?.toISOString() ?? null,
  };
}

export function toAdminLegalDocumentResource(
  document: LegalDocument,
): AdminLegalDocumentResource {
  return {
    ...toLegalDocumentResource(document),
    id: document.id,
    contentEn: document.contentEn,
    summaryEn: document.summaryEn,
    status: document.status,
    updatedAt: document.updatedAt.toISOString(),
  };
}
