import { createHash } from 'node:crypto';

export const CONSENT_TYPES = ['terms', 'privacy', 'location'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_ACTIONS = ['granted', 'revoked'] as const;
export type ConsentAction = (typeof CONSENT_ACTIONS)[number];

export const CONSENT_SOURCES = [
  'registration',
  'settings',
  'account_deletion',
] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export const CONSENT_DOCUMENT_VERSION = '1.0';

export interface ConsentFingerprintInput {
  userId: string;
  type: ConsentType;
  documentVersion: string;
  action: ConsentAction;
  recordedAt: Date;
}

export interface UserConsentRecord {
  id: string;
  type: ConsentType;
  documentVersion: string;
  action: ConsentAction;
  source: ConsentSource;
  recordedAt: Date;
  fingerprint: string;
}

export interface UserConsentsView {
  current: Record<ConsentType, UserConsentRecord | null>;
  history: UserConsentRecord[];
}

// Huella SHA-256 de user_id|type|document_version|action|recorded_at (en UTC
// ISO 8601 con milisegundos, idéntica a la de la migración en PostgreSQL)
export function computeConsentFingerprint(
  input: ConsentFingerprintInput,
): string {
  const payload = [
    input.userId,
    input.type,
    input.documentVersion,
    input.action,
    input.recordedAt.toISOString(),
  ].join('|');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
