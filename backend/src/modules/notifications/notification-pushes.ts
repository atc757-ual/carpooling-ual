import type { PushMessage } from '../../shared/push/push-sender';
import type { NotificationContent } from './notifications.service';
import type { NotificationType } from './entities/notification.entity';

// Los avisos que además van por push (lo importante de un viaje: el resto se
// queda dentro de la app), con el mismo título que en Avisos y una frase que
// dice qué hacer
const PUSH_TEXTS: Partial<
  Record<NotificationType, { title: string; body: string }>
> = {
  request_received: {
    title: 'Te han pedido plaza',
    body: 'Ábrela para aceptarla o rechazarla.',
  },
  request_cancelled: {
    title: 'Han cancelado una solicitud',
    body: 'Se ha liberado una plaza de tu viaje.',
  },
  request_accepted: {
    title: 'Han aceptado tu solicitud',
    body: 'Ya tienes plaza: mira la hora y el punto de recogida.',
  },
  request_rejected: {
    title: 'No han aceptado tu solicitud',
    body: 'Busca otro viaje: tu próxima solicitud tendrá prioridad.',
  },
  trip_cancelled: {
    title: 'Han cancelado el viaje',
    body: 'Busca otro viaje: tu próxima solicitud tendrá prioridad.',
  },
  trip_started: {
    title: 'Tu conductor va de camino',
    body: 'Sigue el coche en el mapa.',
  },
};

// La push de un aviso, o null si ese tipo no va por push. Los datos llevan el
// tipo y los ids para abrir la misma pantalla que el aviso
export function toPushMessage(
  content: NotificationContent,
): PushMessage | null {
  const texts = PUSH_TEXTS[content.type];
  if (!texts || 'legalDocumentId' in content) {
    return null;
  }
  const data: Record<string, string> = {
    type: content.type,
    tripId: content.tripId,
  };
  if (content.requestId) {
    data['requestId'] = content.requestId;
  }
  return { ...texts, data };
}
