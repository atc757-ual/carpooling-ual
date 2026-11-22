import type { AppLanguage } from '../../shared/i18n/app-language';
import type { LocalizedPushMessage } from '../push/push.service';
import type { NotificationContent } from './notifications.service';
import type { NotificationType } from './entities/notification.entity';

interface PushText {
  title: string;
  body: string;
}

type PushTexts = Partial<Record<NotificationType, PushText>>;

// Los avisos que además van por push (lo importante de un viaje: el resto se
// queda dentro de la app), con el mismo título que en Avisos y una frase que
// dice qué hacer, en cada idioma de la app
const PUSH_TEXTS: Record<AppLanguage, PushTexts> = {
  es: {
    request_received: {
      title: 'Te han pedido plaza',
      body: 'Ábrela para aceptarla o rechazarla.',
    },
    passenger_joined: {
      title: 'Alguien se ha unido a tu viaje',
      body: 'Lo has aceptado automáticamente: mira dónde le recoges.',
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
    trip_completed: {
      title: 'Tu viaje ha terminado',
      body: 'Valora a tu conductor: ayuda a la comunidad.',
    },
    trip_auto_finished: {
      title: 'Hemos cerrado tu viaje',
      body: 'Había pasado una hora de la llegada: valora a tus pasajeros.',
    },
    pending_requests_reminder: {
      title: 'Tienes solicitudes por responder',
      body: 'Respóndelas antes de 10 min de la salida o caducarán.',
    },
    trip_expired: {
      title: 'Tu viaje se ha quedado sin pasajeros',
      body: 'Lo hemos cerrado: puedes publicar otro cuando quieras.',
    },
    trip_start_reminder: {
      title: 'Es la hora de tu viaje',
      body: 'Inícialo: si no, se cancelará a los 10 min.',
    },
  },
  en: {
    request_received: {
      title: 'Someone asked for a seat',
      body: 'Open it to accept or decline it.',
    },
    passenger_joined: {
      title: 'Someone joined your ride',
      body: 'You accepted them automatically: see where you pick them up.',
    },
    request_cancelled: {
      title: 'A request was cancelled',
      body: 'A seat on your ride is free again.',
    },
    request_accepted: {
      title: 'Your request was accepted',
      body: 'You have a seat: check the time and the pickup point.',
    },
    request_rejected: {
      title: "Your request wasn't accepted",
      body: 'Look for another ride: your next request will have priority.',
    },
    trip_cancelled: {
      title: 'The ride was cancelled',
      body: 'Look for another ride: your next request will have priority.',
    },
    trip_started: {
      title: 'Your driver is on the way',
      body: 'Follow the car on the map.',
    },
    trip_completed: {
      title: 'Your ride is over',
      body: 'Rate your driver: it helps the community.',
    },
    trip_auto_finished: {
      title: 'We closed your ride',
      body: 'An hour had passed since the arrival: rate your passengers.',
    },
    pending_requests_reminder: {
      title: 'You have requests to answer',
      body: 'Answer them up to 10 min before departure or they will expire.',
    },
    trip_expired: {
      title: 'Your ride ended up with no passengers',
      body: 'We closed it: you can publish another one whenever you like.',
    },
    trip_start_reminder: {
      title: "It's time for your ride",
      body: 'Start it: otherwise it will be cancelled after 10 min.',
    },
  },
};

// La push de un aviso en cada idioma, o null si ese tipo no va por push. Los
// datos llevan el tipo y los ids para abrir la misma pantalla que el aviso
export function toPushMessage(
  content: NotificationContent,
): LocalizedPushMessage | null {
  const es = PUSH_TEXTS.es[content.type];
  const en = PUSH_TEXTS.en[content.type];
  if (!es || !en || 'legalDocumentId' in content) {
    return null;
  }
  const data: Record<string, string> = {
    type: content.type,
    tripId: content.tripId,
  };
  if (content.requestId) {
    data['requestId'] = content.requestId;
  }
  return { es: { ...es, data }, en: { ...en, data } };
}
