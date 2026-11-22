import { localizedPush } from '../push/localized-push';
import type { LocalizedPushMessage } from '../push/push.service';
import type { NotificationContent } from './notifications.service';
import type { NotificationType } from './entities/notification.entity';

// Los avisos que además van por push (lo importante de un viaje: el resto se
// queda dentro de la app). Sus textos, en push.<tipo> de src/i18n: el mismo
// título que en Avisos y una frase que dice qué hacer
const PUSH_TYPES: ReadonlySet<NotificationType> = new Set([
  'request_received',
  'passenger_joined',
  'request_cancelled',
  'request_accepted',
  'request_rejected',
  'trip_cancelled',
  'trip_started',
  'trip_completed',
  'trip_auto_finished',
  'pending_requests_reminder',
  'trip_expired',
  'trip_start_reminder',
]);

// La push de un aviso en cada idioma, o null si ese tipo no va por push. Los
// datos llevan el tipo y los ids para abrir la misma pantalla que el aviso
export function toPushMessage(
  content: NotificationContent,
): LocalizedPushMessage | null {
  if (!PUSH_TYPES.has(content.type) || 'legalDocumentId' in content) {
    return null;
  }
  const data: Record<string, string> = {
    type: content.type,
    tripId: content.tripId,
  };
  if (content.requestId) {
    data['requestId'] = content.requestId;
  }
  return localizedPush(content.type, data);
}
