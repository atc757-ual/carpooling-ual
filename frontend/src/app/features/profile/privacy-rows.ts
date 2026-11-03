import { ConsentRecord } from '../../core/models/user-consent.model';
import {
  LegalDocumentType,
  LegalDocumentView,
} from '../../core/services/users/legal-documents.service';
import { formatStampDate, toConsentStamp } from './consent-stamp';

// Una fila de «Privacidad» en el Perfil
export interface LegalDocRow {
  id: LegalDocumentType;
  title: string;
  // La versión aceptada, su fecha («12 oct 2026») y el principio de su código
  // (SHA-256 del registro); null si no está aceptado
  acceptedVersion: string | null;
  acceptedAt: string | null;
  fingerprint: string | null;
  // Una versión vigente posterior a la aceptada (un cambio menor, que no hay
  // que aceptar): «Vigente: v1.1 · actualizada el 3 nov 2026 · Ver novedades»
  update: { version: string; date: string } | null;
}

export function toLegalDocRow(
  id: LegalDocumentType,
  title: string,
  record: ConsentRecord | null | undefined,
  current: LegalDocumentView | undefined,
): LegalDocRow {
  const accepted = record?.action === 'granted' ? record : null;
  const stamp = accepted ? toConsentStamp(accepted) : null;
  const isNewer =
    accepted !== null &&
    current?.publishedAt != null &&
    current.version !== accepted.documentVersion;
  return {
    id,
    title,
    acceptedVersion: accepted?.documentVersion ?? null,
    acceptedAt: stamp?.date ?? null,
    fingerprint: stamp?.fingerprint ?? null,
    update:
      isNewer && current.publishedAt
        ? { version: current.version, date: formatStampDate(current.publishedAt) }
        : null,
  };
}
