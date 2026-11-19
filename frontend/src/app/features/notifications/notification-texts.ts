import { translate } from '@jsverse/transloco';
import { TravelMode } from '../../core/services/users/active-mode.service';
import { NotificationType } from '../../core/models/notification.model';
import { LegalDocumentType } from '../../core/services/users/legal-documents.service';
import { appLanguage } from '../../core/i18n/app-locale';
import { formatDateLabel } from '../../shared/components/ui/datetime-field/datetime-field';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Con qué modo se ve en Mis viajes; las incidencias son de la administración
// y los avisos legales abren el documento
const MODES: Record<NotificationType, TravelMode | null> = {
  request_received: 'driver',
  passenger_joined: 'driver',
  request_accepted: 'passenger',
  request_rejected: 'passenger',
  request_cancelled: 'driver',
  request_conflict_cancelled: 'passenger',
  trip_cancelled: 'passenger',
  passenger_left: 'driver',
  trip_started: 'passenger',
  incident_reported: null,
  review_requested: 'passenger',
  request_expired: 'passenger',
  passenger_no_show: 'driver',
  trip_completed: 'passenger',
  trip_auto_finished: 'driver',
  pending_requests_reminder: 'driver',
  trip_start_reminder: 'driver',
  trip_expired: 'driver',
  terms_updated: null,
  privacy_updated: null,
};

export function notificationMode(type: NotificationType): TravelMode | null {
  return MODES[type];
}

export function notificationCategory(type: NotificationType): 'travel' | 'account' | 'incident' {
  if (type === 'terms_updated' || type === 'privacy_updated') return 'account';
  return type === 'incident_reported' ? 'incident' : 'travel';
}

// «Ahora», «hace 5 min», «hace 3 h», «Ayer» y después la fecha («jue, 30 oct»)
export function formatElapsed(isoDate: string, now: Date): string {
  const elapsed = now.getTime() - new Date(isoDate).getTime();
  if (elapsed < MINUTE_MS) {
    return translate('labels.elapsed.now');
  }
  if (elapsed < HOUR_MS) {
    return translate('labels.elapsed.minutes', { minutes: Math.floor(elapsed / MINUTE_MS) });
  }
  if (elapsed < DAY_MS) {
    return translate('labels.elapsed.hours', { hours: Math.floor(elapsed / HOUR_MS) });
  }
  const day = new Date(isoDate).toLocaleDateString('sv-SE');
  const yesterday = new Date(now.getTime() - DAY_MS).toLocaleDateString('sv-SE');
  if (day === yesterday) {
    return translate('labels.yesterday');
  }
  return formatDateLabel(day, now, appLanguage());
}

// El documento de un aviso legal (cambio menor), o null si es de un viaje
export function legalDocumentOf(type: NotificationType): LegalDocumentType | null {
  if (type === 'terms_updated') {
    return 'terms';
  }
  return type === 'privacy_updated' ? 'privacy' : null;
}
