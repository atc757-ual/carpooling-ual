import { ConsentRecord } from '../../core/models/user-consent.model';

export interface ConsentStamp {
  // «12 oct 2026»
  date: string;
  // El principio del código que acredita el registro (SHA-256)
  fingerprint: string;
}

const STAMP_DATE = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

// «12 oct 2026»
export function formatStampDate(isoDate: string): string {
  return STAMP_DATE.format(new Date(isoDate));
}

// Fecha y código de un registro de consentimiento, para mostrar en el Perfil
export function toConsentStamp(record: ConsentRecord): ConsentStamp {
  return {
    date: formatStampDate(record.recordedAt),
    fingerprint: `${record.fingerprint.slice(0, 12)}…`,
  };
}
