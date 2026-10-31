import { ApiProperty } from '@nestjs/swagger';
import {
  CONSENT_ACTIONS,
  CONSENT_SOURCES,
  CONSENT_TYPES,
} from '../user-consent';
import type {
  ConsentAction,
  ConsentSource,
  ConsentType,
  UserConsentRecord,
  UserConsentsView,
} from '../user-consent';

export class ConsentRecordResource {
  @ApiProperty({
    format: 'uuid',
    example: '91e78052-415d-4a8e-9b7a-7d98b0cf4902',
  })
  id!: string;

  @ApiProperty({ enum: CONSENT_TYPES, example: 'terms' })
  type!: ConsentType;

  @ApiProperty({ example: '1.0' })
  documentVersion!: string;

  @ApiProperty({ enum: CONSENT_ACTIONS, example: 'granted' })
  action!: ConsentAction;

  @ApiProperty({ enum: CONSENT_SOURCES, example: 'registration' })
  source!: ConsentSource;

  @ApiProperty({ format: 'date-time', example: '2026-10-21T09:15:00.000Z' })
  recordedAt!: string;

  @ApiProperty({
    description:
      'SHA-256 hex digest of user_id|type|document_version|action|recorded_at.',
    example: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
  })
  fingerprint!: string;
}

export class CurrentConsentsResource {
  @ApiProperty({ type: ConsentRecordResource, nullable: true })
  terms!: ConsentRecordResource | null;

  @ApiProperty({ type: ConsentRecordResource, nullable: true })
  privacy!: ConsentRecordResource | null;

  @ApiProperty({ type: ConsentRecordResource, nullable: true })
  location!: ConsentRecordResource | null;
}

// Estado actual de cada consentimiento y su historial completo (de solo
// inserción, incluidas las retiradas)
export class UserConsentsResource {
  @ApiProperty({ example: 'UserConsents' })
  '@type'!: 'UserConsents';

  @ApiProperty({ type: CurrentConsentsResource })
  current!: CurrentConsentsResource;

  @ApiProperty({ type: [ConsentRecordResource] })
  history!: ConsentRecordResource[];
}

function toConsentRecordResource(
  record: UserConsentRecord,
): ConsentRecordResource {
  return {
    id: record.id,
    type: record.type,
    documentVersion: record.documentVersion,
    action: record.action,
    source: record.source,
    recordedAt: record.recordedAt.toISOString(),
    fingerprint: record.fingerprint,
  };
}

export function toUserConsentsResource(
  view: UserConsentsView,
): UserConsentsResource {
  return {
    '@type': 'UserConsents',
    current: {
      terms: view.current.terms
        ? toConsentRecordResource(view.current.terms)
        : null,
      privacy: view.current.privacy
        ? toConsentRecordResource(view.current.privacy)
        : null,
      location: view.current.location
        ? toConsentRecordResource(view.current.location)
        : null,
    },
    history: view.history.map(toConsentRecordResource),
  };
}
