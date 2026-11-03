import { createHash } from 'node:crypto';

export const CONSENT_TYPES = [
  'terms',
  'privacy',
  'location',
  'driver_declaration',
  'vehicle_declaration',
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

// La de cada vehículo va unida a él (vehicle_id) y no tiene un estado único
// por usuario: no entra en «current»
export const CURRENT_CONSENT_TYPES = [
  'terms',
  'privacy',
  'location',
  'driver_declaration',
] as const satisfies readonly ConsentType[];
export type CurrentConsentType = (typeof CURRENT_CONSENT_TYPES)[number];

export const CONSENT_ACTIONS = ['granted', 'revoked'] as const;
export type ConsentAction = (typeof CONSENT_ACTIONS)[number];

// location_prompt: la ventana que explica para qué se usa la ubicación;
// device: el usuario quitó el permiso del sistema y la app lo detectó;
// document_update: acepta una versión nueva de las condiciones o la política;
// driver_setup: acepta la declaración responsable del conductor;
// vehicle_setup: acepta la declaración de un vehículo (seguro e ITV)
export const CONSENT_SOURCES = [
  'registration',
  'settings',
  'account_deletion',
  'location_prompt',
  'device',
  'document_update',
  'driver_setup',
  'vehicle_setup',
] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

// Los que puede enviar la app al registrar el consentimiento de ubicación
export const LOCATION_CONSENT_SOURCES = [
  'settings',
  'location_prompt',
  'device',
] as const satisfies readonly ConsentSource[];
export type LocationConsentSource = (typeof LOCATION_CONSENT_SOURCES)[number];

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
  // El vehículo de una declaración de vehículo; null en los demás
  vehicleId: string | null;
}

export interface UserConsentsView {
  current: Record<CurrentConsentType, UserConsentRecord | null>;
  history: UserConsentRecord[];
}

// Hash SHA-256 del texto de un documento legal tal como se aceptó (el mismo
// que calcula la migración AddLegalDocumentVersioning en PostgreSQL)
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
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
